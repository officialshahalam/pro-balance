"use client";
import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clipboard, Plus, Trash2, Save } from "lucide-react";
import type { AnnexureData } from "@/lib/api-client/statements";
import { parseExcelPaste } from "@/lib/utils/paste-parser";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type DepItem = {
  name: string;
  rate: string;
  wdv_opening: string;
  addition_upto: string;
  addition_after: string;
  sold_transfer: string;
};

function compute(item: DepItem) {
  const rate = parseFloat(item.rate) || 0;
  const wdv = parseFloat(item.wdv_opening) || 0;
  const addUpto = parseFloat(item.addition_upto) || 0;
  const addAfter = parseFloat(item.addition_after) || 0;
  const sold = parseFloat(item.sold_transfer) || 0;
  const total = wdv + addUpto + addAfter - sold;
  const depreciation = Math.ceil((wdv + addUpto) * rate / 100 + addAfter * rate / 200 - 0.5);
  const wdv_closing = Math.ceil(total - depreciation - 0.5);
  return { total, depreciation, wdv_closing };
}

export default function AnnexureDepreciationEditor({ annexure, onSave, onDelete, isSaving }: {
  annexure: AnnexureData;
  onSave: (id: number, data: any) => void;
  onDelete: (id: number) => void;
  isSaving?: boolean;
}) {
  const initItems: DepItem[] = (annexure.data?.items ?? []).map((i: any) => ({
    name: String(i.name || ""),
    rate: String(i.rate || ""),
    wdv_opening: String(i.wdv_opening || ""),
    addition_upto: String(i.addition_upto || ""),
    addition_after: String(i.addition_after || ""),
    sold_transfer: String(i.sold_transfer || ""),
  }));

  const originalRef = useRef(JSON.stringify(initItems));
  const [items, setItems] = useState<DepItem[]>(initItems);
  const isDirty = useMemo(() => JSON.stringify(items) !== originalRef.current, [items]);

  const addRow = () => setItems((prev) => [...prev, { name: "", rate: "", wdv_opening: "", addition_upto: "", addition_after: "", sold_transfer: "" }]);

  const pasteRows = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    // Columns: Name | Rate% | WDV Opening | Addition Upto | Addition After | Sold/Transfer
    const rows = parseExcelPaste(text, 6);
    if (!rows.length) return;
    setItems((prev) => [
      ...prev,
      ...rows.map(([name, rate, wdv_opening, addition_upto, addition_after, sold_transfer]) => ({
        name,
        rate: rate.replace(/%/g, ""),
        wdv_opening,
        addition_upto,
        addition_after,
        sold_transfer,
      })),
    ]);
  };
  const removeRow = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof DepItem, value: string) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const totals = useMemo(() => {
    let wdvOp = 0, addUp = 0, addAf = 0, sold = 0, total = 0, dep = 0, wdvCl = 0;
    items.forEach((item) => {
      const c = compute(item);
      wdvOp += parseFloat(item.wdv_opening) || 0;
      addUp += parseFloat(item.addition_upto) || 0;
      addAf += parseFloat(item.addition_after) || 0;
      sold += parseFloat(item.sold_transfer) || 0;
      total += c.total;
      dep += c.depreciation;
      wdvCl += c.wdv_closing;
    });
    return { wdvOp, addUp, addAf, sold, total, dep, wdvCl };
  }, [items]);

  const handleSave = () => {
    onSave(annexure.id, {
      items: items.filter((i) => i.name.trim()).map((i) => ({
        name: i.name.trim(),
        rate: i.rate,
        wdv_opening: i.wdv_opening,
        addition_upto: i.addition_upto,
        addition_after: i.addition_after,
        sold_transfer: i.sold_transfer,
      })),
    });
  };

  const numCellClass = "h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1";

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Annexure {annexure.ref_code}: {annexure.title}</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDelete(annexure.id)}>
          <Trash2 className="mr-1 h-3 w-3" />Delete
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-225">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="py-1.5 text-left text-xs font-semibold min-w-40">Particulars</th>
              <th className="py-1.5 text-right text-xs font-semibold w-16">Rate%</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">W.D.V. Opening</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">Addition Upto</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">Addition After</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">Sold/Transfer</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">Total</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">Depreciation</th>
              <th className="py-1.5 text-right text-xs font-semibold w-28">W.D.V. Closing</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const c = compute(item);
              return (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1">
                    <Input value={item.name} onChange={(e) => update(idx, "name", e.target.value)}
                      placeholder="Asset name..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                  </td>
                  <td className="py-1">
                    <Input type="number" value={item.rate || ""} onChange={(e) => update(idx, "rate", e.target.value)}
                      placeholder="-" className={numCellClass} />
                  </td>
                  <td className="py-1">
                    <Input type="number" value={item.wdv_opening || ""} onChange={(e) => update(idx, "wdv_opening", e.target.value)}
                      placeholder="-" className={numCellClass} />
                  </td>
                  <td className="py-1">
                    <Input type="number" value={item.addition_upto || ""} onChange={(e) => update(idx, "addition_upto", e.target.value)}
                      placeholder="-" className={numCellClass} />
                  </td>
                  <td className="py-1">
                    <Input type="number" value={item.addition_after || ""} onChange={(e) => update(idx, "addition_after", e.target.value)}
                      placeholder="-" className={numCellClass} />
                  </td>
                  <td className="py-1">
                    <Input type="number" value={item.sold_transfer || ""} onChange={(e) => update(idx, "sold_transfer", e.target.value)}
                      placeholder="-" className={numCellClass} />
                  </td>
                  <td className="py-1 text-right font-mono text-xs text-muted-foreground">{fmt(c.total)}</td>
                  <td className="py-1 text-right font-mono text-xs text-muted-foreground">{fmt(c.depreciation)}</td>
                  <td className="py-1 text-right font-mono text-xs text-muted-foreground">{fmt(c.wdv_closing)}</td>
                  <td className="py-1 w-8 text-center">
                    <button onClick={() => removeRow(idx)} className="text-muted-foreground/30 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={10} className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={addRow} className="h-6 text-xs text-muted-foreground">
                  <Plus className="mr-1 h-3 w-3" />Add
                </Button>
                <Button size="sm" variant="ghost" onClick={pasteRows} title="Paste from Excel (Name ↹ Rate% ↹ WDV Opening ↹ Addition Upto ↹ Addition After ↹ Sold/Transfer)" className="h-6 text-xs text-muted-foreground">
                  <Clipboard className="mr-1 h-3 w-3" />Paste
                </Button>
              </td>
            </tr>
            <tr className="border-t-2 border-foreground font-bold">
              <td className="py-1.5 text-xs" colSpan={2}>Total</td>
              <td className="py-1.5 text-right font-mono text-xs">{fmt(totals.wdvOp)}</td>
              <td className="py-1.5 text-right font-mono text-xs">{fmt(totals.addUp)}</td>
              <td className="py-1.5 text-right font-mono text-xs">{fmt(totals.addAf)}</td>
              <td className="py-1.5 text-right font-mono text-xs">{fmt(totals.sold)}</td>
              <td className="py-1.5 text-right font-mono text-xs border-t-2 border-foreground">{fmt(totals.total)}</td>
              <td className="py-1.5 text-right font-mono text-xs border-t-2 border-foreground">{fmt(totals.dep)}</td>
              <td className="py-1.5 text-right font-mono text-xs border-t-2 border-b-2 border-foreground">{fmt(totals.wdvCl)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          <Save className="mr-1.5 h-3.5 w-3.5" />{isSaving ? "Saving..." : "Save Annexure"}
        </Button>
      </div>
    </div>
  );
}
