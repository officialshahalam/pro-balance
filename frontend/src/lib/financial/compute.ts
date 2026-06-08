import type { BSRow } from "@/lib/templates/balance-sheet";
import type { PLData } from "@/lib/templates/profit-loss";
import type { AnnexureData } from "@/lib/api-client/statements";

export type AnnEntry = { ref_code: string; total: number; depreciation?: number };
export type AnnexureMap = Record<string, AnnEntry>;
export type BSData = { liabilities: BSRow[]; assets: BSRow[] };

// ─── Annexure map (mirrors the annexureMap useMemo in the client page) ──────
export function buildAnnexureMap(annexures: AnnexureData[]): AnnexureMap {
  const map: AnnexureMap = {};
  annexures.forEach((ann) => {
    if (ann.ann_type === "depreciation_schedule") {
      const items = (ann.data as any)?.items ?? [];
      let wdvTotal = 0;
      let depTotal = 0;
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
}

// ─── Net profit (mirrors the netProfit useMemo) ─────────────────────────────
export function computeNetProfit(plData: PLData | null, annexureMap: AnnexureMap): number {
  if (!plData) return 0;
  const getAmt = (item: any) => {
    if (item?.annexure_ref && annexureMap[item.annexure_ref]) {
      const ann = annexureMap[item.annexure_ref];
      return ann.depreciation !== undefined ? ann.depreciation : ann.total;
    }
    return item?.amount ?? 0;
  };
  const credit = getAmt(plData.trading.credit.sales)
    + getAmt(plData.trading.credit.closing_stock)
    + (plData.trading.credit.other_income ?? []).reduce((s: number, e: any) => s + e.amount, 0);
  const debit = getAmt(plData.trading.debit.opening_stock)
    + getAmt(plData.trading.debit.purchases)
    + (plData.trading.debit.direct_expenses ?? []).reduce((s: number, e: any) => s + getAmt(e), 0);
  const gross = credit - debit;
  const indirect = (plData.pl.indirect_expenses ?? []).reduce((s: number, e: any) => s + getAmt(e), 0);
  const otherIncome = (plData.pl.other_income ?? []).reduce((s: number, e: any) => s + e.amount, 0);
  return gross + otherIncome - indirect;
}

// ─── Capital account ref + net-profit-enriched map ──────────────────────────
export function getCapitalAccountRef(bsData: BSData | null): string | undefined {
  return bsData?.liabilities.find((r) => r.id === "1a")?.annexure_ref;
}

export function enrichAnnexureMap(
  annexureMap: AnnexureMap,
  capitalRef: string | undefined,
  netProfit: number,
): AnnexureMap {
  if (!capitalRef || !annexureMap[capitalRef]) return annexureMap;
  return {
    ...annexureMap,
    [capitalRef]: { ...annexureMap[capitalRef], total: annexureMap[capitalRef].total + netProfit },
  };
}

// Note: the projected-Balance-Sheet auto-balance now runs on the backend inside
// projectFY/reProjectFY (annexure.service.ts); the frontend only computes display values.
