"use client";
import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clipboard, Plus, Trash2, Save } from "lucide-react";
import type { AnnexureData } from "@/lib/api-client/statements";
import { parseExcelPasteKV } from "@/lib/utils/paste-parser";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AnnexureEditor({ annexure, onSave, onDelete, isSaving }: {
  annexure: AnnexureData;
  onSave: (id: number, data: { items: { name: string; amount: number }[] }) => void;
  onDelete: (id: number) => void;
  isSaving?: boolean;
}) {
  const originalRef = useRef(
    JSON.stringify((annexure.data?.items ?? []).map((i: any) => ({ name: i.name, amount: String(i.amount || "") })))
  );

  const [items, setItems] = useState<{ name: string; amount: string }[]>(
    (annexure.data?.items ?? []).map((i: any) => ({ name: i.name, amount: String(i.amount || "") }))
  );

  const isDirty = useMemo(() => JSON.stringify(items) !== originalRef.current, [items]);

  const addItem = () => setItems((prev) => [...prev, { name: "", amount: "" }]);

  const pasteItems = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPasteKV(text);
    if (!rows.length) return;
    setItems((prev) => [...prev, ...rows.map(([name, amount]) => ({ name, amount }))]);
  };

  const updateItem = (index: number, field: "name" | "amount", value: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const handleSave = () => {
    onSave(annexure.id, {
      items: items.filter((i) => i.name.trim()).map((i) => ({
        name: i.name.trim(),
        amount: parseFloat(i.amount) || 0,
      })),
    });
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Annexure {annexure.ref_code}: {annexure.title}
        </h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDelete(annexure.id)}>
          <Trash2 className="mr-1 h-3 w-3" />Delete
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Particulars</th>
            <th className="pb-2 font-medium text-right w-40">Amount (₹)</th>
            <th className="pb-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-border/50">
              <td className="py-1">
                <Input value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)}
                  placeholder="Particulars..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
              </td>
              <td className="py-1">
                <Input type="number" value={item.amount} onChange={(e) => updateItem(idx, "amount", e.target.value)}
                  placeholder="0" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
              </td>
              <td className="py-1 w-8 text-center">
                <button onClick={() => removeItem(idx)} className="text-muted-foreground/30 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={addItem} className="h-6 text-xs text-muted-foreground">
                <Plus className="mr-1 h-3 w-3" />Add
              </Button>
              <Button size="sm" variant="ghost" onClick={pasteItems} title="Paste from Excel (Name ↹ Amount)" className="h-6 text-xs text-muted-foreground">
                <Clipboard className="mr-1 h-3 w-3" />Paste
              </Button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td className="pt-2 text-xs">Total</td>
            <td className="pt-2 text-right font-mono text-xs">{fmt(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="mt-3">
        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          <Save className="mr-1.5 h-3.5 w-3.5" />{isSaving ? "Saving..." : "Save Annexure"}
        </Button>
      </div>
    </div>
  );
}
