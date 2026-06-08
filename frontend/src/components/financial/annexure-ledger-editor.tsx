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

type LedgerItem = { name: string; amount: string };

export default function AnnexureLedgerEditor({ annexure, onSave, onDelete, isSaving, netProfit }: {
  annexure: AnnexureData;
  onSave: (id: number, data: any) => void;
  onDelete: (id: number) => void;
  isSaving?: boolean;
  netProfit?: number;
}) {
  const initDebit = (annexure.data?.debit ?? []).map((i: any) => ({ name: i.name, amount: String(i.amount || "") }));
  const initCredit = (annexure.data?.credit ?? []).map((i: any) => ({ name: i.name, amount: String(i.amount || "") }));

  const originalRef = useRef(JSON.stringify({ debit: initDebit, credit: initCredit }));

  const [debit, setDebit] = useState<LedgerItem[]>(initDebit);
  const [credit, setCredit] = useState<LedgerItem[]>(initCredit);

  const isDirty = useMemo(() => JSON.stringify({ debit, credit }) !== originalRef.current, [debit, credit]);

  const debitTotal = debit.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const creditTotal = credit.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const npAmt = netProfit ?? 0;
  const adjustedCreditTotal = creditTotal + npAmt;
  const balanceCd = adjustedCreditTotal - debitTotal;
  const grandTotal = adjustedCreditTotal;

  const addDebit = () => setDebit((prev) => [...prev, { name: "", amount: "" }]);
  const addCredit = () => setCredit((prev) => [...prev, { name: "", amount: "" }]);

  const pasteDebit = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPaste(text, 2);
    if (!rows.length) return;
    setDebit((prev) => [...prev, ...rows.map(([name, amount]) => ({ name, amount }))]);
  };
  const pasteCredit = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPaste(text, 2);
    if (!rows.length) return;
    setCredit((prev) => [...prev, ...rows.map(([name, amount]) => ({ name, amount }))]);
  };

  const updateDebit = (idx: number, field: "name" | "amount", value: string) => {
    setDebit((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const updateCredit = (idx: number, field: "name" | "amount", value: string) => {
    setCredit((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeDebit = (idx: number) => setDebit((prev) => prev.filter((_, i) => i !== idx));
  const removeCredit = (idx: number) => setCredit((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    onSave(annexure.id, {
      debit: debit.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), amount: parseFloat(i.amount) || 0 })),
      credit: credit.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), amount: parseFloat(i.amount) || 0 })),
      items: [{ name: "Balance c/d", amount: Math.max(0, balanceCd) }],
    });
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Annexure {annexure.ref_code}: {annexure.title}</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => onDelete(annexure.id)}>
          <Trash2 className="mr-1 h-3 w-3" />Delete
        </Button>
      </div>

      <div className="flex gap-4 items-stretch">
        {/* Debit side */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="py-1.5 text-left text-xs font-semibold">Particulars</th>
                  <th className="py-1.5 text-right text-xs font-semibold w-32">Amount (₹)</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {debit.map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1">
                      <Input value={item.name} onChange={(e) => updateDebit(idx, "name", e.target.value)}
                        placeholder="To ..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                    </td>
                    <td className="py-1">
                      <Input type="number" value={item.amount} onChange={(e) => updateDebit(idx, "amount", e.target.value)}
                        placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
                    </td>
                    <td className="py-1 w-8 text-center">
                      <button onClick={() => removeDebit(idx)} className="text-muted-foreground/30 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={addDebit} className="h-6 text-xs text-muted-foreground">
                      <Plus className="mr-1 h-3 w-3" />Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={pasteDebit} title="Paste from Excel (Particulars ↹ Amount)" className="h-6 text-xs text-muted-foreground">
                      <Clipboard className="mr-1 h-3 w-3" />Paste
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="font-semibold"><td className="py-1 text-xs">To Balance c/d</td><td className="py-1 text-right font-mono text-xs w-32">{fmt(Math.max(0, balanceCd))}</td><td className="w-6" /></tr>
              <tr className="border-t-2 border-foreground font-bold"><td className="py-1.5 text-xs">Total</td><td className="py-1.5 text-right font-mono text-xs w-32 border-t-2 border-b-2 border-foreground">{fmt(grandTotal)}</td><td className="w-6" /></tr>
            </tbody>
          </table>
        </div>

        <div className="w-px bg-border" />

        {/* Credit side */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="py-1.5 text-left text-xs font-semibold">Particulars</th>
                  <th className="py-1.5 text-right text-xs font-semibold w-32">Amount (₹)</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {credit.map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1">
                      <Input value={item.name} onChange={(e) => updateCredit(idx, "name", e.target.value)}
                        placeholder="By ..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                    </td>
                    <td className="py-1">
                      <Input type="number" value={item.amount} onChange={(e) => updateCredit(idx, "amount", e.target.value)}
                        placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
                    </td>
                    <td className="py-1 w-8 text-center">
                      <button onClick={() => removeCredit(idx)} className="text-muted-foreground/30 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={addCredit} className="h-6 text-xs text-muted-foreground">
                      <Plus className="mr-1 h-3 w-3" />Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={pasteCredit} title="Paste from Excel (Particulars ↹ Amount)" className="h-6 text-xs text-muted-foreground">
                      <Clipboard className="mr-1 h-3 w-3" />Paste
                    </Button>
                  </td>
                </tr>
                {netProfit !== undefined && (
                  <tr className="border-b border-border/50">
                    <td className="py-1 text-xs px-1.5">
                      By Net {netProfit >= 0 ? "Profit" : "Loss"}
                    </td>
                    <td className="py-1 text-right font-mono text-xs w-32">
                      {fmt(Math.abs(netProfit))}
                    </td>
                    <td className="w-6" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-t-2 border-foreground font-bold"><td className="py-1.5 text-xs">Total</td><td className="py-1.5 text-right font-mono text-xs w-32 border-t-2 border-b-2 border-foreground">{fmt(grandTotal)}</td><td className="w-6" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          <Save className="mr-1.5 h-3.5 w-3.5" />{isSaving ? "Saving..." : "Save Annexure"}
        </Button>
      </div>
    </div>
  );
}
