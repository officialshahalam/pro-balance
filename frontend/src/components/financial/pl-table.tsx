"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clipboard, Plus, Trash2 } from "lucide-react";
import type { PLData, PLItem } from "@/lib/templates/profit-loss";
import { useMemo } from "react";
import { parseExcelPaste } from "@/lib/utils/paste-parser";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ItemRow({ item, onAmountChange, onCreateAnnexure, onClickAnnexure, annexureMap, onRemove }: {
  item: PLItem;
  onAmountChange: (amount: number) => void;
  onCreateAnnexure?: (id: string, label: string) => void;
  onClickAnnexure?: (refCode: string) => void;
  annexureMap: Record<string, { ref_code: string; total: number; depreciation?: number }>;
  onRemove?: () => void;
}) {
  const annData = item.annexure_ref ? annexureMap[item.annexure_ref] : null;
  const displayAmount = annData ? (annData.depreciation !== undefined ? annData.depreciation : annData.total) : item.amount;

  return (
    <tr className="hover:bg-muted/30">
      <td className="py-1 text-xs">{item.label}</td>
      <td className="py-1 text-center w-20">
        {item.hasAnnexure && (
          item.annexure_ref ? (
            <button onClick={() => onClickAnnexure?.(item.annexure_ref!)} className="text-xs text-primary hover:underline">
              Ann. {item.annexure_ref}
            </button>
          ) : (
            <button onClick={() => onCreateAnnexure?.(item.id, item.label)} className="text-muted-foreground/40 hover:text-primary">
              <Plus className="h-3.5 w-3.5 inline" />
            </button>
          )
        )}
      </td>
      <td className="py-1 w-32">
        {item.annexure_ref ? (
          <div className="text-right font-mono text-xs text-muted-foreground">{fmt(displayAmount)}</div>
        ) : (
          <Input type="number" value={item.amount || ""} onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
        )}
      </td>
      {onRemove && (
        <td className="py-1 w-6">
          <button onClick={onRemove} className="text-muted-foreground/30 hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
      )}
    </tr>
  );
}

export default function PLTable({ data, onChange, onCreateAnnexure, onClickAnnexure, annexureMap }: {
  data: PLData;
  onChange: (data: PLData) => void;
  onCreateAnnexure: (id: string, label: string) => void;
  onClickAnnexure: (refCode: string) => void;
  annexureMap: Record<string, { ref_code: string; total: number; depreciation?: number }>;
}) {
  if (!data?.trading?.debit || !data?.trading?.credit || !data?.pl) {
    return <div className="text-sm text-muted-foreground">Loading P&L data...</div>;
  }

  const getAmt = (item: PLItem) => {
    if (item.annexure_ref && annexureMap[item.annexure_ref]) {
      const ann = annexureMap[item.annexure_ref];
      if (ann.depreciation !== undefined) return ann.depreciation;
      return ann.total;
    }
    return item.amount;
  };

  const totals = useMemo(() => {
    if (!data?.trading?.debit || !data?.trading?.credit || !data?.pl) {
      return { openingStock: 0, purchases: 0, directTotal: 0, sales: 0, closingStock: 0, tradingCreditOther: 0, debitTrading: 0, creditTrading: 0, grossProfit: 0, indirectTotal: 0, plOtherIncome: 0, netProfit: 0, tradingTotal: 0, plTotal: 0 };
    }
    const openingStock = getAmt(data.trading.debit.opening_stock);
    const purchases = getAmt(data.trading.debit.purchases);
    const directTotal = data.trading.debit.direct_expenses.reduce((s, e) => s + e.amount, 0);
    const sales = getAmt(data.trading.credit.sales);
    const closingStock = getAmt(data.trading.credit.closing_stock);

    const tradingCreditOther = (data.trading.credit.other_income ?? []).reduce((s, e) => s + e.amount, 0);
    const debitTrading = openingStock + purchases + directTotal;
    const creditTrading = sales + closingStock + tradingCreditOther;
    const grossProfit = creditTrading - debitTrading;

    const indirectTotal = data.pl.indirect_expenses.reduce((s, e) => s + getAmt(e), 0);
    const plOtherIncome = (data.pl.other_income ?? []).reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit + plOtherIncome - indirectTotal;

    const tradingTotal = Math.max(debitTrading + Math.max(0, grossProfit), creditTrading);
    const plTotal = Math.max(indirectTotal + Math.max(0, netProfit), Math.max(0, grossProfit) + plOtherIncome);

    return { openingStock, purchases, directTotal, sales, closingStock, tradingCreditOther, debitTrading, creditTrading, grossProfit, indirectTotal, plOtherIncome, netProfit, tradingTotal, plTotal };
  }, [data, annexureMap]);

  const updateItem = (path: string, amount: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    if (path === "opening_stock") next.trading.debit.opening_stock.amount = amount;
    else if (path === "purchases") next.trading.debit.purchases.amount = amount;
    else if (path === "sales") next.trading.credit.sales.amount = amount;
    else if (path === "closing_stock") next.trading.credit.closing_stock.amount = amount;
    onChange(next);
  };

  const updateDirectExp = (index: number, amount: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.debit.direct_expenses[index].amount = amount;
    onChange(next);
  };

  const addDirectExp = () => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.debit.direct_expenses.push({ id: `de_${Date.now()}`, label: "", amount: 0 });
    onChange(next);
  };

  const pasteDirectExp = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPaste(text, 2);
    if (!rows.length) return;
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    rows.forEach(([label, amount], i) => {
      next.trading.debit.direct_expenses.push({ id: `de_${Date.now()}_${i}`, label, amount: parseFloat(amount) || 0 });
    });
    onChange(next);
  };

  const removeDirectExp = (index: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.debit.direct_expenses.splice(index, 1);
    onChange(next);
  };

  const renameDirectExp = (index: number, label: string) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.debit.direct_expenses[index].label = label;
    onChange(next);
  };

  const updateIndirectExp = (index: number, amount: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.indirect_expenses[index].amount = amount;
    onChange(next);
  };

  const addIndirectExp = () => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.indirect_expenses.push({ id: `ie_${Date.now()}`, label: "", amount: 0 });
    onChange(next);
  };

  const pasteIndirectExp = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPaste(text, 2);
    if (!rows.length) return;
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    rows.forEach(([label, amount], i) => {
      next.pl.indirect_expenses.push({ id: `ie_${Date.now()}_${i}`, label, amount: parseFloat(amount) || 0 });
    });
    onChange(next);
  };

  const removeIndirectExp = (index: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.indirect_expenses.splice(index, 1);
    onChange(next);
  };

  const renameIndirectExp = (index: number, label: string) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.indirect_expenses[index].label = label;
    onChange(next);
  };

  // Trading credit other income
  const addTradingCreditItem = () => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    if (!next.trading.credit.other_income) next.trading.credit.other_income = [];
    next.trading.credit.other_income.push({ id: `tci_${Date.now()}`, label: "", amount: 0 });
    onChange(next);
  };

  const pasteTradingCreditItem = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPaste(text, 2);
    if (!rows.length) return;
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    if (!next.trading.credit.other_income) next.trading.credit.other_income = [];
    rows.forEach(([label, amount], i) => {
      next.trading.credit.other_income.push({ id: `tci_${Date.now()}_${i}`, label, amount: parseFloat(amount) || 0 });
    });
    onChange(next);
  };
  const removeTradingCreditItem = (index: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.credit.other_income.splice(index, 1);
    onChange(next);
  };
  const renameTradingCreditItem = (index: number, label: string) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.credit.other_income[index].label = label;
    onChange(next);
  };
  const updateTradingCreditItem = (index: number, amount: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.trading.credit.other_income[index].amount = amount;
    onChange(next);
  };

  // P&L other income
  const addPlOtherIncome = () => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    if (!next.pl.other_income) next.pl.other_income = [];
    next.pl.other_income.push({ id: `poi_${Date.now()}`, label: "", amount: 0 });
    onChange(next);
  };

  const pastePlOtherIncome = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const rows = parseExcelPaste(text, 2);
    if (!rows.length) return;
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    if (!next.pl.other_income) next.pl.other_income = [];
    rows.forEach(([label, amount], i) => {
      next.pl.other_income.push({ id: `poi_${Date.now()}_${i}`, label, amount: parseFloat(amount) || 0 });
    });
    onChange(next);
  };
  const removePlOtherIncome = (index: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.other_income.splice(index, 1);
    onChange(next);
  };
  const renamePlOtherIncome = (index: number, label: string) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.other_income[index].label = label;
    onChange(next);
  };
  const updatePlOtherIncome = (index: number, amount: number) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    next.pl.other_income[index].amount = amount;
    onChange(next);
  };

  const updateAnnexureRef = (itemId: string, refCode: string) => {
    const next = JSON.parse(JSON.stringify(data)) as PLData;
    if (next.trading.debit.opening_stock.id === itemId) next.trading.debit.opening_stock.annexure_ref = refCode;
    else if (next.trading.debit.purchases.id === itemId) next.trading.debit.purchases.annexure_ref = refCode;
    else if (next.trading.credit.sales.id === itemId) next.trading.credit.sales.annexure_ref = refCode;
    else if (next.trading.credit.closing_stock.id === itemId) next.trading.credit.closing_stock.annexure_ref = refCode;
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* TRADING ACCOUNT */}
      <div>
        <h3 className="mb-2 text-center text-sm font-bold uppercase tracking-wider">Trading Account</h3>
        <div className="flex gap-4 items-stretch">
          {/* Debit side */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-foreground">
                    <th className="py-1.5 text-left text-xs font-semibold">Particulars</th>
                    <th className="py-1.5 text-center text-xs font-semibold w-20">Annexure</th>
                    <th className="py-1.5 text-right text-xs font-semibold w-32">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <ItemRow item={data.trading.debit.opening_stock} onAmountChange={(a) => updateItem("opening_stock", a)}
                    onCreateAnnexure={onCreateAnnexure} onClickAnnexure={onClickAnnexure} annexureMap={annexureMap} />
                  <ItemRow item={data.trading.debit.purchases} onAmountChange={(a) => updateItem("purchases", a)}
                    onCreateAnnexure={onCreateAnnexure} onClickAnnexure={onClickAnnexure} annexureMap={annexureMap} />
                  <tr><td colSpan={3} className="pt-2 pb-1 text-xs font-semibold">DIRECT EXPENSES</td></tr>
                  {data.trading.debit.direct_expenses.map((exp, i) => (
                    <tr key={exp.id} className="hover:bg-muted/30">
                      <td className="py-1">
                        <Input value={exp.label} onChange={(e) => renameDirectExp(i, e.target.value)}
                          placeholder="Expense name..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                      </td>
                      <td />
                      <td className="py-1">
                        <Input type="number" value={exp.amount || ""} onChange={(e) => updateDirectExp(i, parseFloat(e.target.value) || 0)}
                          placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="py-1 w-6">
                        <button onClick={() => removeDirectExp(i)} className="text-muted-foreground/30 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr><td colSpan={4} className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={addDirectExp} className="h-6 text-xs text-muted-foreground"><Plus className="mr-1 h-3 w-3" />Add</Button><Button size="sm" variant="ghost" onClick={pasteDirectExp} title="Paste from Excel (Name ↹ Amount)" className="h-6 text-xs text-muted-foreground"><Clipboard className="mr-1 h-3 w-3" />Paste</Button></td></tr>
                </tbody>
              </table>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="font-semibold"><td className="py-1 text-xs">To Gross Profit c/d</td><td className="w-20" /><td className="py-1 text-right font-mono text-xs w-32">{totals.grossProfit >= 0 ? fmt(totals.grossProfit) : ""}</td></tr>
                <tr className="border-t-2 border-foreground font-bold"><td className="py-1.5 text-xs">Total</td><td className="w-20" /><td className="py-1.5 text-right font-mono text-xs w-32 border-t-2 border-b-2 border-foreground">{fmt(totals.tradingTotal)}</td></tr>
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
                    <th className="py-1.5 text-center text-xs font-semibold w-20">Annexure</th>
                    <th className="py-1.5 text-right text-xs font-semibold w-32">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <ItemRow item={data.trading.credit.sales} onAmountChange={(a) => updateItem("sales", a)}
                    onCreateAnnexure={onCreateAnnexure} onClickAnnexure={onClickAnnexure} annexureMap={annexureMap} />
                  <ItemRow item={data.trading.credit.closing_stock} onAmountChange={(a) => updateItem("closing_stock", a)}
                    onCreateAnnexure={onCreateAnnexure} onClickAnnexure={onClickAnnexure} annexureMap={annexureMap} />
                  {(data.trading.credit.other_income ?? []).map((item, i) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="py-1">
                        <Input value={item.label} onChange={(e) => renameTradingCreditItem(i, e.target.value)}
                          placeholder="Income name..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                      </td>
                      <td />
                      <td className="py-1">
                        <Input type="number" value={item.amount || ""} onChange={(e) => updateTradingCreditItem(i, parseFloat(e.target.value) || 0)}
                          placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="py-1 w-6">
                        <button onClick={() => removeTradingCreditItem(i)} className="text-muted-foreground/30 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr><td colSpan={4} className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={addTradingCreditItem} className="h-6 text-xs text-muted-foreground"><Plus className="mr-1 h-3 w-3" />Add</Button><Button size="sm" variant="ghost" onClick={pasteTradingCreditItem} title="Paste from Excel (Name ↹ Amount)" className="h-6 text-xs text-muted-foreground"><Clipboard className="mr-1 h-3 w-3" />Paste</Button></td></tr>
                </tbody>
              </table>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-t-2 border-foreground font-bold"><td className="py-1.5 text-xs">Total</td><td className="w-20" /><td className="py-1.5 text-right font-mono text-xs w-32 border-t-2 border-b-2 border-foreground">{fmt(totals.tradingTotal)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* P&L ACCOUNT */}
      <div>
        <h3 className="mb-2 text-center text-sm font-bold uppercase tracking-wider">Profit & Loss Account</h3>
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
                  <tr><td colSpan={3} className="pt-1 pb-1 text-xs font-semibold">INDIRECT EXPENSES</td></tr>
                  {data.pl.indirect_expenses.map((exp, i) => {
                    const expAnn = exp.annexure_ref ? annexureMap[exp.annexure_ref] : null;
                    const expAmount = expAnn ? (expAnn.depreciation !== undefined ? expAnn.depreciation : expAnn.total) : null;
                    return (
                      <tr key={exp.id} className="hover:bg-muted/30">
                        <td className="py-1">
                          <Input value={exp.label} onChange={(e) => renameIndirectExp(i, e.target.value)}
                            placeholder="Expense name..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                        </td>
                        <td className="py-1">
                          {exp.annexure_ref ? (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => onClickAnnexure(exp.annexure_ref!)} className="text-xs text-primary hover:underline">
                                Ann. {exp.annexure_ref}
                              </button>
                              <span className="font-mono text-xs text-muted-foreground">{fmt(expAmount ?? 0)}</span>
                            </div>
                          ) : (
                            <Input type="number" value={exp.amount || ""} onChange={(e) => updateIndirectExp(i, parseFloat(e.target.value) || 0)}
                              placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
                          )}
                        </td>
                        <td className="py-1">
                          {!exp.annexure_ref && (
                            <button onClick={() => removeIndirectExp(i)} className="text-muted-foreground/30 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan={3} className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={addIndirectExp} className="h-6 text-xs text-muted-foreground"><Plus className="mr-1 h-3 w-3" />Add</Button><Button size="sm" variant="ghost" onClick={pasteIndirectExp} title="Paste from Excel (Name ↹ Amount)" className="h-6 text-xs text-muted-foreground"><Clipboard className="mr-1 h-3 w-3" />Paste</Button></td></tr>
                </tbody>
              </table>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="font-semibold"><td className="py-1 text-xs">To Net Profit c/d</td><td className="py-1 text-right font-mono text-xs w-32">{totals.netProfit >= 0 ? fmt(totals.netProfit) : ""}</td><td className="w-6" /></tr>
                {totals.netProfit < 0 && (
                  <tr className="font-semibold text-destructive"><td className="py-1 text-xs">Net Loss</td><td className="py-1 text-right font-mono text-xs w-32">{fmt(Math.abs(totals.netProfit))}</td><td className="w-6" /></tr>
                )}
                <tr className="border-t-2 border-foreground font-bold"><td className="py-1.5 text-xs">Total</td><td className="py-1.5 text-right font-mono text-xs w-32 border-t-2 border-b-2 border-foreground">{fmt(totals.plTotal)}</td><td className="w-6" /></tr>
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
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold">
                    <td className="py-1 text-xs">Gross Profit b/f</td>
                    <td className="py-1 text-right font-mono text-xs">{fmt(Math.max(0, totals.grossProfit))}</td>
                  </tr>
                  {(data.pl.other_income ?? []).map((item, i) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="py-1">
                        <Input value={item.label} onChange={(e) => renamePlOtherIncome(i, e.target.value)}
                          placeholder="Income name..." className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="py-1">
                        <Input type="number" value={item.amount || ""} onChange={(e) => updatePlOtherIncome(i, parseFloat(e.target.value) || 0)}
                          placeholder="-" className="h-7 rounded-xs border-0 bg-transparent px-1.5 text-right font-mono text-xs shadow-none focus-visible:ring-1" />
                      </td>
                      <td className="py-1 w-6">
                        <button onClick={() => removePlOtherIncome(i)} className="text-muted-foreground/30 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={addPlOtherIncome} className="h-6 text-xs text-muted-foreground"><Plus className="mr-1 h-3 w-3" />Add</Button><Button size="sm" variant="ghost" onClick={pastePlOtherIncome} title="Paste from Excel (Name ↹ Amount)" className="h-6 text-xs text-muted-foreground"><Clipboard className="mr-1 h-3 w-3" />Paste</Button></td></tr>
                </tbody>
              </table>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-t-2 border-foreground font-bold"><td className="py-1.5 text-xs">Total</td><td className="py-1.5 text-right font-mono text-xs w-32 border-t-2 border-b-2 border-foreground">{fmt(totals.plTotal)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Net result highlight */}
      <div className={`flex justify-between rounded border-2 p-3 text-base font-bold ${
        totals.netProfit >= 0 ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <span>{totals.netProfit >= 0 ? "Net Profit" : "Net Loss"}</span>
        <span className="font-mono">₹ {fmt(Math.abs(totals.netProfit))}</span>
      </div>
    </div>
  );
}
