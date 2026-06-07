"use client";
import { use, useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/api-client/clients";
import { getFinancialYears, deleteFinancialYear, createFinancialYear } from "@/lib/api-client/financial-years";
import { getStatement, saveStatement, getAnnexures, createAnnexure, updateAnnexure, deleteAnnexure, projectFY, reProjectFY, type AnnexureData } from "@/lib/api-client/statements";
import { getDefaultBSData, type BSRow, DYNAMIC_SECTIONS } from "@/lib/templates/balance-sheet";
import { getDefaultPLData, type PLData } from "@/lib/templates/profit-loss";
import BSTable from "@/components/financial/bs-table";
import PLTable from "@/components/financial/pl-table";
import AnnexureEditor from "@/components/financial/annexure-editor";
import AnnexureLedgerEditor from "@/components/financial/annexure-ledger-editor";
import AnnexureDepreciationEditor from "@/components/financial/annexure-depreciation-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, TrendingUp, Plus, FileDown } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useRef } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import Link from "next/link";

type Tab = "bs" | "pl" | "annexures";
type LocalAnnexure = AnnexureData & { _isNew?: boolean };

let tempAnnId = -1;

export default function ClientFinancialPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const cid = Number(clientId);
  const qc = useQueryClient();

  const { user } = useAuthStore();
  const { data: client } = useQuery({ queryKey: ["client", cid], queryFn: () => getClient(cid) });
  const { data: fys, isLoading: fysLoading } = useQuery({ queryKey: ["financial-years", cid], queryFn: () => getFinancialYears(cid) });

  const [selectedFyId, setSelectedFyId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("bs");

  // Create first FY
  const [createFyOpen, setCreateFyOpen] = useState(false);
  const [fyStartDate, setFyStartDate] = useState("");

  const computeFyEndDate = (start: string) => {
    if (!start) return "";
    const s = new Date(start);
    s.setFullYear(s.getFullYear() + 1);
    s.setDate(s.getDate() - 1);
    return s.toISOString().split("T")[0];
  };

  const computeFyLabel = (start: string) => {
    if (!start) return "";
    const s = new Date(start);
    return `${s.getFullYear()}-${String(s.getFullYear() + 1).slice(-2)}`;
  };

  const handleCreateFY = async () => {
    if (!fyStartDate) { toast.error("Select a start date"); return; }
    const endDate = computeFyEndDate(fyStartDate);
    const label = computeFyLabel(fyStartDate);
    try {
      const newFy = await createFinancialYear(cid, { label, start_date: fyStartDate, end_date: endDate });
      qc.invalidateQueries({ queryKey: ["financial-years", cid] });
      setSelectedFyId(newFy.id);
      setCreateFyOpen(false);
      toast.success(`FY ${newFy.label} created`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create financial year");
    }
  };

  // Projection
  const [projOpen, setProjOpen] = useState(false);
  const [growthPercent, setGrowthPercent] = useState("");

  // Adjust growth
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPercent, setAdjustPercent] = useState("");

  // Annexure focus (scroll + highlight on navigation)
  const [focusedAnnexure, setFocusedAnnexure] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "annexures" || !focusedAnnexure) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`annexure-${focusedAnnexure}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "transition-shadow");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "transition-shadow"), 2000);
      }
      setFocusedAnnexure(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [tab, focusedAnnexure]);

  // FY context menu (right-click)
  const [ctxMenu, setCtxMenu] = useState<{ fyId: number; fyLabel: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    if (ctxMenu) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  const handleDeleteFY = async (fyId: number, fyLabel: string) => {
    setCtxMenu(null);
    if (!await confirm({ title: "Delete Financial Year", description: `Delete FY ${fyLabel} and all its data (Balance Sheet, P&L, Annexures)? This cannot be undone.`, confirmLabel: "Delete", destructive: true })) return;
    try {
      await deleteFinancialYear(fyId);
      qc.invalidateQueries({ queryKey: ["financial-years", cid] });
      if (selectedFyId === fyId) {
        const remaining = fys?.filter((f: any) => f.id !== fyId);
        setSelectedFyId(remaining?.length ? remaining[0].id : null);
      }
      toast.success(`FY ${fyLabel} deleted`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  // Local state
  const [bsData, setBsData] = useState<{ liabilities: BSRow[]; assets: BSRow[] } | null>(null);
  const [plData, setPlData] = useState<PLData | null>(null);
  const [localAnnexures, setLocalAnnexures] = useState<LocalAnnexure[]>([]);

  // Server snapshots for isDirty comparison
  const serverBsRef = useRef<string>("");
  const serverPlRef = useRef<string>("");
  const serverAnnRef = useRef<string>("");

  // Migrate old assets format (1a subheader + sub-items) to new flat format
  const migrateAssets = (rows: BSRow[]): BSRow[] => {
    let result = [...rows];
    const hasOldFormat = result.some((r) => r.id.startsWith("1a_") && r.type === "item");
    if (hasOldFormat) {
      result = result.filter((r) => !r.id.startsWith("1a_"));
      result = result.map((r) => {
        if (r.id === "1a") return { ...r, type: "item" as const, indent: 1, section: "1", amount: r.amount ?? 0 };
        if (["1b", "1c", "1d", "1e"].includes(r.id) && r.type === "item") return { ...r, section: "1" };
        return r;
      });
    }
    // Ensure Fixed Assets item exists (added after old data was saved)
    if (!result.find((r) => r.id === "1a0")) {
      const subheaderIdx = result.findIndex((r) => r.id === "1" && r.type === "subheader");
      const fixedAssets: BSRow = { id: "1a0", label: "Fixed Assets", type: "item", indent: 1, section: "1", amount: 0 };
      if (subheaderIdx !== -1) result.splice(subheaderIdx + 1, 0, fixedAssets);
    }
    return result;
  };

  // Ensure items in dynamic sections have their section property set (old saved data may lack it)
  const normalizeSections = (rows: BSRow[], side: "liabilities" | "assets"): BSRow[] => {
    const sections = DYNAMIC_SECTIONS[side];
    return rows.map((r) => {
      if (r.type !== "item" || r.section) return r;
      for (const sec of sections) {
        if (r.id.match(new RegExp(`^${sec}[a-z]$`))) {
          return { ...r, section: sec };
        }
      }
      return r;
    });
  };

  // Ensure add_button rows exist in BS data loaded from server
  const ensureAddButtons = (rows: BSRow[], side: "liabilities" | "assets"): BSRow[] => {
    const sections = DYNAMIC_SECTIONS[side];
    let result = [...rows];
    for (const sec of sections) {
      const addId = `${sec}_add`;
      if (!result.find((r) => r.id === addId)) {
        const subId = `${sec}_sub`;
        const subIdx = result.findIndex((r) => r.id === subId);
        const addRow: BSRow = { id: addId, label: "Add", type: "add_button", section: sec };
        if (subIdx !== -1) {
          result.splice(subIdx, 0, addRow);
        } else {
          let lastIdx = -1;
          for (let i = 0; i < result.length; i++) {
            if (result[i].section === sec) lastIdx = i;
          }
          if (lastIdx !== -1) result.splice(lastIdx + 1, 0, addRow);
          else result.push(addRow);
        }
      }
    }
    return result;
  };

  // Select first FY on load
  useEffect(() => {
    if (fys?.length && !selectedFyId) setSelectedFyId(fys[0].id);
  }, [fys, selectedFyId]);

  // Load data when FY changes
  const { data: bsRaw } = useQuery({
    queryKey: ["statement", selectedFyId, "bs"],
    queryFn: () => getStatement(selectedFyId!, "balance-sheet"),
    enabled: !!selectedFyId,
  });
  const { data: plRaw } = useQuery({
    queryKey: ["statement", selectedFyId, "pl"],
    queryFn: () => getStatement(selectedFyId!, "profit-loss"),
    enabled: !!selectedFyId,
  });
  const { data: annexuresRaw } = useQuery({
    queryKey: ["annexures", selectedFyId],
    queryFn: () => getAnnexures(selectedFyId!),
    enabled: !!selectedFyId,
  });

  useEffect(() => {
    let data = bsRaw ?? (selectedFyId ? getDefaultBSData() : null);
    if (data) {
      data = {
        liabilities: ensureAddButtons(normalizeSections(data.liabilities, "liabilities"), "liabilities"),
        assets: ensureAddButtons(migrateAssets(normalizeSections(data.assets, "assets")), "assets"),
      };
    }
    setBsData(data);
    serverBsRef.current = JSON.stringify(data);
  }, [bsRaw, selectedFyId]);

  useEffect(() => {
    const data = plRaw ?? (selectedFyId ? getDefaultPLData() : null);
    setPlData(data);
    serverPlRef.current = JSON.stringify(data);
  }, [plRaw, selectedFyId]);

  useEffect(() => {
    const data = annexuresRaw ?? [];
    setLocalAnnexures(data);
    serverAnnRef.current = JSON.stringify(data);
  }, [annexuresRaw]);

  // Per-sheet dirty tracking
  const isBsDirty = useMemo(() => JSON.stringify(bsData) !== serverBsRef.current, [bsData]);
  const isPlDirty = useMemo(() => JSON.stringify(plData) !== serverPlRef.current, [plData]);
  const currentDirty = tab === "bs" ? isBsDirty : tab === "pl" ? isPlDirty : false;

  // Browser beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isBsDirty || isPlDirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isBsDirty, isPlDirty]);

  // Unsaved changes dialog state
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const guardedAction = (action: () => void) => {
    if (!currentDirty) { action(); return; }
    pendingActionRef.current = action;
    setUnsavedOpen(true);
  };

  const handleUnsavedSave = async () => {
    setUnsavedOpen(false);
    if (tab === "bs") await saveBs();
    else if (tab === "pl") await savePl();
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  };

  const handleUnsavedDiscard = () => {
    setUnsavedOpen(false);
    if (tab === "bs") setBsData(JSON.parse(serverBsRef.current || "null"));
    else if (tab === "pl") setPlData(JSON.parse(serverPlRef.current || "null"));
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  };

  const handleUnsavedCancel = () => {
    setUnsavedOpen(false);
    pendingActionRef.current = null;
  };

  // Annexure map for cross-referencing
  const annexureMap = useMemo(() => {
    const map: Record<string, { ref_code: string; total: number; depreciation?: number }> = {};
    localAnnexures.forEach((ann) => {
      if (ann.ann_type === "depreciation_schedule") {
        const items = ann.data?.items ?? [];
        let wdvTotal = 0, depTotal = 0;
        items.forEach((i: any) => {
          const rate = parseFloat(i.rate) || 0;
          const wdv = parseFloat(i.wdv_opening) || 0;
          const addUpto = parseFloat(i.addition_upto) || 0;
          const addAfter = parseFloat(i.addition_after) || 0;
          const sold = parseFloat(i.sold_transfer) || 0;
          const total = wdv + addUpto + addAfter - sold;
          const dep = Math.ceil((wdv + addUpto) * rate / 100 + addAfter * rate / 200 - 0.5);
          const wdvClosing = Math.ceil(total - dep - 0.5);
          wdvTotal += wdvClosing;
          depTotal += dep;
        });
        map[ann.ref_code] = { ref_code: ann.ref_code, total: wdvTotal, depreciation: depTotal };
      } else if (ann.ann_type === "ledger") {
        const creditTotal = (ann.data?.credit ?? []).reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
        const debitTotal = (ann.data?.debit ?? []).reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
        map[ann.ref_code] = { ref_code: ann.ref_code, total: Math.max(0, creditTotal - debitTotal) };
      } else {
        const total = (ann.data?.items ?? []).reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
        map[ann.ref_code] = { ref_code: ann.ref_code, total };
      }
    });
    return map;
  }, [localAnnexures]);

  // Get next available ref code
  const getNextRefCode = () => {
    const used = new Set(localAnnexures.map((a) => a.ref_code));
    let code = "A";
    while (used.has(code)) code = String.fromCharCode(code.charCodeAt(0) + 1);
    return code;
  };

  // Create annexure LOCALLY (no DB call)
  const handleCreateAnnexure = (rowId: string, label: string, side?: "liabilities" | "assets") => {
    const refCode = getNextRefCode();
    const isLedger = rowId === "1a" && side === "liabilities";
    const isDepreciation = rowId === "1a0" && side === "assets";
    let annType = "key_value";
    let data: any = { items: [] };
    if (isLedger) { annType = "ledger"; data = { debit: [], credit: [], items: [] }; }
    if (isDepreciation) { annType = "depreciation_schedule"; data = { items: [] }; }
    const newAnn: LocalAnnexure = {
      id: tempAnnId--,
      ref_code: refCode,
      title: label,
      ann_type: annType,
      data,
      _isNew: true,
    };
    setLocalAnnexures((prev) => [...prev, newAnn]);

    // Link the BS/PL row to this annexure ref
    if (side) {
      setBsData((prev) => {
        if (!prev) return prev;
        return { ...prev, [side]: prev[side].map((r) => r.id === rowId ? { ...r, annexure_ref: refCode } : r) };
      });
      // Auto-link depreciation to P&L Depreciation expense
      if (isDepreciation) {
        setPlData((prev) => {
          if (!prev) return prev;
          const next = JSON.parse(JSON.stringify(prev)) as PLData;
          const depExpense = next.pl.indirect_expenses.find((e) => e.label === "Depreciation");
          if (depExpense) depExpense.annexure_ref = refCode;
          return next;
        });
      }
    } else {
      setPlData((prev) => {
        if (!prev) return prev;
        const next = JSON.parse(JSON.stringify(prev)) as PLData;
        const setRef = (item: any) => { if (item.id === rowId) item.annexure_ref = refCode; };
        setRef(next.trading.debit.opening_stock);
        setRef(next.trading.debit.purchases);
        setRef(next.trading.credit.sales);
        setRef(next.trading.credit.closing_stock);
        return next;
      });
    }

    setFocusedAnnexure(refCode);
    setTab("annexures");
    toast.success(`Annexure ${refCode} created — fill the details below`);
  };

  // Click annexure ref → navigate to annexures tab + scroll to it
  const handleClickAnnexure = (refCode: string) => {
    setFocusedAnnexure(refCode);
    setTab("annexures");
  };

  // Update local annexure data
  // Save annexure to DB → redirect back to source sheet → mark sheet dirty
  const handleSaveAnnexure = async (id: number, data: { items: { name: string; amount: number }[] }) => {
    // Update local state first
    setLocalAnnexures((prev) => prev.map((a) => a.id === id ? { ...a, data } : a));

    if (!selectedFyId) return;
    const ann = localAnnexures.find((a) => a.id === id);
    try {
      if (ann && (ann._isNew || ann.id < 0)) {
        await createAnnexure(selectedFyId, { title: ann.title, ann_type: ann.ann_type, data });
      } else {
        await updateAnnexure(id, { data });
      }
      qc.invalidateQueries({ queryKey: ["annexures", selectedFyId] });
      toast.success(`Annexure ${ann?.ref_code} saved`);

      // Find which sheet this annexure belongs to and redirect there
      const ref = ann?.ref_code;
      const bsHasRef = bsData?.liabilities.some((r) => r.annexure_ref === ref) || bsData?.assets.some((r) => r.annexure_ref === ref);
      if (bsHasRef) {
        setTab("bs");
      } else {
        setTab("pl");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  // Delete local annexure
  const handleDeleteLocalAnnexure = async (id: number) => {
    const ann = localAnnexures.find((a) => a.id === id);
    if (!ann) return;
    // For DB-backed annexures (positive ID), delete from backend first
    if (id > 0) {
      try {
        await deleteAnnexure(id);
        qc.invalidateQueries({ queryKey: ["annexures", selectedFyId] });
      } catch {
        toast.error("Failed to delete annexure");
        return;
      }
    }
    // Remove annexure ref from BS/PL
    const ref = ann.ref_code;
    setBsData((prev) => {
      if (!prev) return prev;
      return {
        liabilities: prev.liabilities.map((r) => r.annexure_ref === ref ? { ...r, annexure_ref: undefined } : r),
        assets: prev.assets.map((r) => r.annexure_ref === ref ? { ...r, annexure_ref: undefined } : r),
      };
    });
    setPlData((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as PLData;
      const clearRef = (item: any) => { if (item.annexure_ref === ref) item.annexure_ref = undefined; };
      clearRef(next.trading.debit.opening_stock);
      clearRef(next.trading.debit.purchases);
      clearRef(next.trading.credit.sales);
      clearRef(next.trading.credit.closing_stock);
      return next;
    });
    setLocalAnnexures((prev) => prev.filter((a) => a.id !== id));
    toast.success(`Annexure ${ref} deleted`);
  };

  // Per-sheet save functions
  const [bsSaving, setBsSaving] = useState(false);
  const [plSaving, setPlSaving] = useState(false);

  const saveBs = async () => {
    if (!selectedFyId || !bsData) return;
    setBsSaving(true);
    try {
      // Save any new annexures first
      for (const ann of localAnnexures) {
        if (ann._isNew || ann.id < 0) {
          await createAnnexure(selectedFyId, { title: ann.title, ann_type: ann.ann_type, data: ann.data });
        }
      }
      await saveStatement(selectedFyId, "balance-sheet", bsData);
      qc.invalidateQueries({ queryKey: ["statement", selectedFyId, "bs"] });
      qc.invalidateQueries({ queryKey: ["annexures", selectedFyId] });
      toast.success("Balance Sheet saved");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setBsSaving(false);
    }
  };

  const savePl = async () => {
    if (!selectedFyId || !plData) return;
    setPlSaving(true);
    try {
      for (const ann of localAnnexures) {
        if (ann._isNew || ann.id < 0) {
          await createAnnexure(selectedFyId, { title: ann.title, ann_type: ann.ann_type, data: ann.data });
        }
      }
      await saveStatement(selectedFyId, "profit-loss", plData);
      qc.invalidateQueries({ queryKey: ["statement", selectedFyId, "pl"] });
      qc.invalidateQueries({ queryKey: ["annexures", selectedFyId] });
      toast.success("Profit & Loss saved");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setPlSaving(false);
    }
  };

  // BS handlers
  const updateBSAmount = (side: "liabilities" | "assets", id: string, amount: number) => {
    setBsData((prev) => prev ? { ...prev, [side]: prev[side].map((r) => r.id === id ? { ...r, amount } : r) } : prev);
  };
  const updateBSLabel = (side: "liabilities" | "assets", id: string, label: string) => {
    setBsData((prev) => prev ? { ...prev, [side]: prev[side].map((r) => r.id === id ? { ...r, label } : r) } : prev);
  };
  const addBSRow = (section: string, side: "liabilities" | "assets") => {
    setBsData((prev) => {
      if (!prev) return prev;
      const rows = [...prev[side]];
      const addIdx = rows.findIndex((r) => r.id === `${section}_add`);
      if (addIdx === -1) return prev;
      const indent = 1;
      const newRow: BSRow = {
        id: `${section}_dyn_${Date.now()}`,
        label: "",
        type: "item",
        indent,
        amount: 0,
        isDynamic: true,
        section,
      };
      rows.splice(addIdx, 0, newRow);
      return { ...prev, [side]: rows };
    });
  };
  const removeBSRow = (id: string, side: "liabilities" | "assets") => {
    setBsData((prev) => prev ? { ...prev, [side]: prev[side].filter((r) => r.id !== id) } : prev);
  };

  const pasteBSRows = (section: string, side: "liabilities" | "assets", pastedRows: { label: string; amount: number }[]) => {
    setBsData((prev) => {
      if (!prev) return prev;
      const rows = [...prev[side]];
      const addIdx = rows.findIndex((r) => r.id === `${section}_add`);
      if (addIdx === -1) return prev;
      const newRows: BSRow[] = pastedRows.map((r, i) => ({
        id: `${section}_dyn_${Date.now()}_${i}`,
        label: r.label,
        type: "item" as const,
        indent: 1,
        amount: r.amount,
        isDynamic: true,
        section,
      }));
      rows.splice(addIdx, 0, ...newRows);
      return { ...prev, [side]: rows };
    });
  };

  // Projection
  const handleProject = async () => {
    if (!selectedFyId) return;
    const growth = parseFloat(growthPercent);
    if (isNaN(growth)) { toast.error("Enter valid growth %"); return; }
    try {
      // Save current data first
      await saveBs();
      await savePl();
      const newFy = await projectFY(selectedFyId, growth);
      qc.invalidateQueries({ queryKey: ["financial-years", cid] });
      setSelectedFyId(newFy.id);
      setProjOpen(false);
      setGrowthPercent("");
      toast.success(`FY ${newFy.label} projected with ${growth}% growth`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  // Adjust growth
  const handleAdjustGrowth = async () => {
    if (!selectedFyId) return;
    const growth = parseFloat(adjustPercent);
    if (isNaN(growth)) { toast.error("Enter valid growth %"); return; }
    try {
      await reProjectFY(selectedFyId, growth);
      qc.invalidateQueries({ queryKey: ["financial-years", cid] });
      qc.invalidateQueries({ queryKey: ["statement", selectedFyId] });
      qc.invalidateQueries({ queryKey: ["annexures", selectedFyId] });
      setAdjustOpen(false);
      toast.success(`FY re-projected with ${growth}% growth`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  // PDF export
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!client || !selectedFy || !bsData || !plData) return;
    setExporting(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: ReportDocument } = await import("@/components/pdf/report-document");
      const today = new Date();
      const fyStart = new Date(selectedFy.start_date);
      const fyEnd = new Date(selectedFy.end_date);
      let reportType = "";
      if (today > fyEnd) reportType = "";
      else if (today >= fyStart && today <= fyEnd) reportType = "ESTIMATED";
      else reportType = "PROJECTED";
      const doc = ReportDocument({ client, user, fy: selectedFy, bsData, plData, annexures: localAnnexures, annexureMap, reportType });
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${client.name}_BS_PL_${selectedFy.label}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch (err: any) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!client) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;

  const selectedFy = fys?.find((f: any) => f.id === selectedFyId);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar — simplified */}
      <div className="flex items-center border-b px-4 h-12">
        <div className="flex items-center gap-3">
          <Link href="/clients" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold">{client.name}</h1>
        </div>
      </div>

      {/* Content */}
      {fysLoading || (fys && fys.length > 0 && !selectedFyId) ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
      ) : !selectedFyId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">No financial year found. Create one to get started.</p>
          <Button size="sm" onClick={() => {
            const now = new Date();
            const fyYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
            setFyStartDate(`${fyYear}-04-01`);
            setCreateFyOpen(true);
          }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Create Financial Year
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable content */}
          <div className="flex-1 overflow-auto p-4">
            {tab === "bs" && bsData && (
              <BSTable
                liabilities={bsData.liabilities}
                assets={bsData.assets}
                onLiabilityChange={(id, amt) => updateBSAmount("liabilities", id, amt)}
                onAssetChange={(id, amt) => updateBSAmount("assets", id, amt)}
                onLiabilityLabelChange={(id, label) => updateBSLabel("liabilities", id, label)}
                onAssetLabelChange={(id, label) => updateBSLabel("assets", id, label)}
                onCreateAnnexure={handleCreateAnnexure}
                onClickAnnexure={handleClickAnnexure}
                onAddRow={addBSRow}
                onRemoveRow={removeBSRow}
                onPasteRows={pasteBSRows}
                annexureMap={annexureMap}
              />
            )}
            {tab === "pl" && plData && (
              <PLTable
                data={plData}
                onChange={(d) => setPlData(d)}
                onCreateAnnexure={(id, label) => handleCreateAnnexure(id, label)}
                onClickAnnexure={handleClickAnnexure}
                annexureMap={annexureMap}
              />
            )}
            {tab === "annexures" && (
              <div className="space-y-4">
                {!localAnnexures.length ? (
                  <p className="text-sm text-muted-foreground">No annexures yet. Click the + icon in Balance Sheet or P&L to create one.</p>
                ) : (
                  localAnnexures.map((ann) => (
                    <div key={ann.id} id={`annexure-${ann.ref_code}`}>
                      {ann.ann_type === "depreciation_schedule" ? (
                        <AnnexureDepreciationEditor
                          annexure={ann}
                          onSave={(id, data) => handleSaveAnnexure(id, data)}
                          onDelete={handleDeleteLocalAnnexure}
                        />
                      ) : ann.ann_type === "ledger" ? (
                        <AnnexureLedgerEditor
                          annexure={ann}
                          onSave={(id, data) => handleSaveAnnexure(id, data)}
                          onDelete={handleDeleteLocalAnnexure}
                        />
                      ) : (
                        <AnnexureEditor
                          annexure={ann}
                          onSave={(id, data) => handleSaveAnnexure(id, data)}
                          onDelete={handleDeleteLocalAnnexure}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Fixed per-sheet save bar */}
          {(tab === "bs" || tab === "pl") && (
            <div className="flex items-center justify-end border-t bg-background px-4 py-1">
              <Button
                size="sm"
                onClick={tab === "bs" ? saveBs : savePl}
                disabled={tab === "bs" ? (!isBsDirty || bsSaving) : (!isPlDirty || plSaving)}
                className="h-8"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {(tab === "bs" ? bsSaving : plSaving) ? "Saving..." : `Save ${tab === "bs" ? "Balance Sheet" : "Profit & Loss"}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bottom — Row 1: Sheet tabs */}
      {selectedFyId && (
        <div className="flex items-center border-t bg-muted/20">
          {(["bs", "pl", "annexures"] as const).map((t) => {
            const labels = { bs: "Balance Sheet", pl: "Profit & Loss", annexures: "Annexures" };
            return (
              <button
                key={t}
                onClick={() => guardedAction(() => setTab(t))}
                className={`px-4 py-2 text-xs font-medium border-r transition-colors ${
                  tab === t
                    ? "bg-background text-foreground border-t-2 border-t-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom — Row 2: FY buttons + Create Projected + Save */}
      <div className="flex items-center justify-between border-t bg-muted/10 py-2">
        <div className="flex items-center gap-1 px-3">
          {fys?.map((fy: any) => (
            <button
              key={fy.id}
              onClick={() => guardedAction(() => setSelectedFyId(fy.id))}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ fyId: fy.id, fyLabel: fy.label, x: e.clientX, y: e.clientY }); }}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                selectedFyId === fy.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {fy.label}
            </button>
          ))}
          {ctxMenu && (
            <div
              className="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
            >
              <button
                onClick={() => handleDeleteFY(ctxMenu.fyId, ctxMenu.fyLabel)}
                className="flex w-full items-center rounded-sm px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                Delete FY {ctxMenu.fyLabel}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-3">
          {selectedFyId && (
            <>
              <Button size="sm" variant="outline" onClick={() => setProjOpen(true)} className="h-7 text-xs">
                <TrendingUp className="mr-1 h-3 w-3" />Create Projected Reports
              </Button>
              {selectedFy?.source_fy_id && (
                <Button size="sm" variant="outline" onClick={() => { setAdjustPercent(String(selectedFy.growth_percent ?? "")); setAdjustOpen(true); }} className="h-7 text-xs">
                  <TrendingUp className="mr-1 h-3 w-3" />Adjust Growth
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting} className="h-7 text-xs">
                <FileDown className="mr-1 h-3 w-3" />{exporting ? "Exporting..." : "Export Reports"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Create First FY Dialog */}
      <Dialog open={createFyOpen} onOpenChange={setCreateFyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Financial Year</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={fyStartDate} onChange={(e) => setFyStartDate(e.target.value)} />
            </div>
            {fyStartDate && (
              <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End Date</span>
                  <span className="font-mono font-medium">{computeFyEndDate(fyStartDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FY Label</span>
                  <span className="font-mono font-medium">{computeFyLabel(fyStartDate)}</span>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleCreateFY}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Projection Dialog */}
      <Dialog open={projOpen} onOpenChange={setProjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Projected Reports</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Project from FY {selectedFy?.label}. All amounts × growth factor.
            </p>
            <div className="space-y-1">
              <Label>Business Growth Rate (%)</Label>
              <Input type="number" value={growthPercent} onChange={(e) => setGrowthPercent(e.target.value)}
                placeholder="e.g. 10" className="font-mono text-lg text-center" autoFocus />
            </div>
            {growthPercent && !isNaN(parseFloat(growthPercent)) && (
              <div className="rounded border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Growth Factor</span>
                  <span className="font-mono font-medium">× {(1 + parseFloat(growthPercent) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleProject}>Generate Projected FY</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Growth Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Growth Rate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Re-project FY {selectedFy?.label} with a new growth rate. This will overwrite all current data in this FY.
            </p>
            <div className="space-y-1">
              <Label>New Growth Rate (%)</Label>
              <Input type="number" value={adjustPercent} onChange={(e) => setAdjustPercent(e.target.value)}
                placeholder="e.g. 10" className="font-mono text-lg text-center" autoFocus />
            </div>
            {adjustPercent && !isNaN(parseFloat(adjustPercent)) && (
              <div className="rounded border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Growth Factor</span>
                  <span className="font-mono font-medium">× {(1 + parseFloat(adjustPercent) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleAdjustGrowth}>Re-project FY</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <Dialog open={unsavedOpen} onOpenChange={(open) => { if (!open) handleUnsavedCancel(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have unsaved changes. What would you like to do?
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button size="sm" onClick={handleUnsavedSave}>
              <Save className="mr-1.5 h-3.5 w-3.5" />Save & Continue
            </Button>
            <Button size="sm" variant="outline" onClick={handleUnsavedDiscard}>
              Discard Changes
            </Button>
            <Button size="sm" variant="ghost" onClick={handleUnsavedCancel}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
