"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clipboard, Plus, Trash2 } from "lucide-react";
import { parseExcelPaste } from "@/lib/utils/paste-parser";
import type { BSRow } from "@/lib/templates/balance-sheet";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BSColumn({ rows, onAmountChange, onLabelChange, onCreateAnnexure, onClickAnnexure, onAddRow, onRemoveRow, onPasteRows, annexureMap }: {
  rows: BSRow[];
  onAmountChange: (id: string, amount: number) => void;
  onLabelChange: (id: string, label: string) => void;
  onCreateAnnexure: (rowId: string, label: string) => void;
  onClickAnnexure: (refCode: string) => void;
  onAddRow: (section: string) => void;
  onRemoveRow: (id: string) => void;
  onPasteRows: (section: string, rows: { label: string; amount: number }[]) => void;
  annexureMap: Record<string, { ref_code: string; total: number; depreciation?: number }>;
}) {
  const getAmount = (r: BSRow) => {
    if (r.annexure_ref && annexureMap[r.annexure_ref]) return annexureMap[r.annexure_ref].total;
    return r.amount ?? 0;
  };

  const calcSubtotal = (sectionPrefix: string) =>
    rows
      .filter((r) => (r.section === sectionPrefix || r.id.startsWith(sectionPrefix)) && r.type === "item")
      .reduce((s, r) => s + getAmount(r), 0);

  const total = rows.filter((r) => r.type === "item").reduce((s, r) => s + getAmount(r), 0);

  const sectionItemMap: Record<string, BSRow[]> = {};
  rows.forEach((r) => {
    if (r.type === "item" && r.section) {
      if (!sectionItemMap[r.section]) sectionItemMap[r.section] = [];
      sectionItemMap[r.section].push(r);
    }
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="py-2 text-left text-xs font-semibold w-8"></th>
              <th className="py-2 text-left text-xs font-semibold">Particulars</th>
              <th className="py-2 text-center text-xs font-semibold w-20">Annexure</th>
              <th className="py-2 text-right text-xs font-semibold w-32">Amount (₹)</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.type !== "total").map((row) => {
              const annData = row.annexure_ref ? annexureMap[row.annexure_ref] : null;
              const displayAmount = annData ? annData.total : row.amount;

              if (row.type === "header") {
                return (
                  <tr key={row.id}>
                    <td className="py-1.5 text-xs font-bold">{row.id}</td>
                    <td colSpan={4} className="py-1.5 text-xs font-bold uppercase">{row.label}</td>
                  </tr>
                );
              }
              if (row.type === "subheader") {
                const indent = (row.indent ?? 0) * 12;
                return (
                  <tr key={row.id}>
                    <td className="py-1 text-xs font-semibold">{row.id}</td>
                    <td colSpan={4} className="py-1 text-xs font-semibold" style={{ paddingLeft: indent }}>{row.label}</td>
                  </tr>
                );
              }
              if (row.type === "subtotal") {
                const prefix = row.id.replace("_sub", "");
                const sub = calcSubtotal(prefix);
                return (
                  <tr key={row.id} className="border-t">
                    <td colSpan={3}></td>
                    <td className="py-1 text-right font-mono text-xs font-medium border-t">{fmt(sub)}</td>
                    <td />
                  </tr>
                );
              }
              if (row.type === "add_button") {
                const handlePaste = async () => {
                  const text = await navigator.clipboard.readText().catch(() => "");
                  const parsed = parseExcelPaste(text, 2);
                  if (!parsed.length) return;
                  onPasteRows(row.section!, parsed.map(([label, amount]) => ({ label, amount: parseFloat(amount) || 0 })));
                };
                return (
                  <tr key={row.id}>
                    <td></td>
                    <td colSpan={4} className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onAddRow(row.section!)} className="h-6 text-xs text-muted-foreground">
                        <Plus className="mr-1 h-3 w-3" />Add
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handlePaste} title="Paste from Excel (Name ↹ Amount)" className="h-6 text-xs text-muted-foreground">
                        <Clipboard className="mr-1 h-3 w-3" />Paste
                      </Button>
                    </td>
                  </tr>
                );
              }

              const indent = (row.indent ?? 0) * 16;
              let rowLabel: string;
              if (row.section) {
                const items = sectionItemMap[row.section] ?? [];
                const idx = items.indexOf(row);
                rowLabel = idx >= 0 ? `(${String.fromCharCode(97 + idx)})` : "";
              } else {
                rowLabel = row.id.replace(/(\d+)([a-z]?)(_.*)?/, (_, num, letter) => {
                  if (letter) return `(${letter})`;
                  return num;
                });
              }

              return (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="py-1 text-xs text-muted-foreground">{rowLabel}</td>
                  <td className="py-1 text-xs" style={{ paddingLeft: indent }}>
                    {row.isDynamic ? (
                      <Input value={row.label} onChange={(e) => onLabelChange(row.id, e.target.value)}
                        placeholder="Enter name..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                    ) : (
                      row.label
                    )}
                  </td>
                  <td className="py-1 text-center">
                    {row.annexure_ref ? (
                      <button onClick={() => onClickAnnexure(row.annexure_ref!)} className="text-xs text-primary cursor-pointer hover:underline">
                        Ann. {row.annexure_ref}
                      </button>
                    ) : (
                      <button onClick={() => onCreateAnnexure(row.id, row.label)} className="text-muted-foreground/40 hover:text-primary">
                        <Plus className="h-3.5 w-3.5 inline" />
                      </button>
                    )}
                  </td>
                  <td className="py-1">
                    {row.annexure_ref ? (
                      <div className="text-right font-mono text-xs text-muted-foreground">{fmt(displayAmount ?? 0)}</div>
                    ) : (
                      <Input type="number" value={row.amount || ""} onChange={(e) => onAmountChange(row.id, parseFloat(e.target.value) || 0)}
                        className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" placeholder="-" />
                    )}
                  </td>
                  <td className="py-1 w-8 text-center">
                    {row.isDynamic && (
                      <button onClick={() => onRemoveRow(row.id)} className="text-muted-foreground/30 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <table className="w-full text-sm border-collapse">
        <tbody>
          <tr className="border-t-2 border-foreground">
            <td className="w-8"></td>
            <td className="py-2 font-bold text-sm">Total</td>
            <td className="w-20"></td>
            <td className="py-2 text-right font-mono font-bold text-sm w-32 border-t-2 border-b-2 border-foreground">{fmt(total)}</td>
            <td className="w-8" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BSTable({ liabilities, assets, onLiabilityChange, onAssetChange, onLiabilityLabelChange, onAssetLabelChange, onCreateAnnexure, onClickAnnexure, onAddRow, onRemoveRow, onPasteRows, annexureMap }: {
  liabilities: BSRow[];
  assets: BSRow[];
  onLiabilityChange: (id: string, amount: number) => void;
  onAssetChange: (id: string, amount: number) => void;
  onLiabilityLabelChange: (id: string, label: string) => void;
  onAssetLabelChange: (id: string, label: string) => void;
  onCreateAnnexure: (rowId: string, label: string, side: "liabilities" | "assets") => void;
  onClickAnnexure: (refCode: string) => void;
  onAddRow: (section: string, side: "liabilities" | "assets") => void;
  onRemoveRow: (id: string, side: "liabilities" | "assets") => void;
  onPasteRows: (section: string, side: "liabilities" | "assets", rows: { label: string; amount: number }[]) => void;
  annexureMap: Record<string, { ref_code: string; total: number; depreciation?: number }>;
}) {
  return (
    <div className="flex gap-6 items-stretch">
      <BSColumn
        rows={liabilities}
        onAmountChange={onLiabilityChange}
        onLabelChange={onLiabilityLabelChange}
        onCreateAnnexure={(id, label) => onCreateAnnexure(id, label, "liabilities")}
        onClickAnnexure={onClickAnnexure}
        onAddRow={(section) => onAddRow(section, "liabilities")}
        onRemoveRow={(id) => onRemoveRow(id, "liabilities")}
        onPasteRows={(section, rows) => onPasteRows(section, "liabilities", rows)}
        annexureMap={annexureMap}
      />
      <div className="w-px bg-border" />
      <BSColumn
        rows={assets}
        onAmountChange={onAssetChange}
        onLabelChange={onAssetLabelChange}
        onCreateAnnexure={(id, label) => onCreateAnnexure(id, label, "assets")}
        onClickAnnexure={onClickAnnexure}
        onAddRow={(section) => onAddRow(section, "assets")}
        onRemoveRow={(id) => onRemoveRow(id, "assets")}
        onPasteRows={(section, rows) => onPasteRows(section, "assets", rows)}
        annexureMap={annexureMap}
      />
    </div>
  );
}
