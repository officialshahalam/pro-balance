import api from "./index";
import { liabilitiesTemplate, assetsTemplate, type BSRow } from "@/lib/templates/balance-sheet";
import { getDefaultPLData, type PLData, type PLItem } from "@/lib/templates/profit-loss";

// ─── DB row type (returned by GET /statement-lines) ──────────

type StatementLine = {
  id: number;
  financial_year_id: number;
  statement_type: string;
  section: string;
  slot_key: string | null;
  label: string | null;
  amount: string; // Decimal serialized as string from Prisma
  annexure_ref: string | null;
  is_dynamic: boolean;
  sort_order: number;
};

type BulkLine = {
  section: string;
  slot_key?: string | null;
  label?: string | null;
  amount: number;
  annexure_ref?: string | null;
  is_dynamic: boolean;
  sort_order: number;
};

// ─── Mapping tables ──────────────────────────────────────────

// For save: template id → slot_key (liabilities side)
const LIAB_ID_TO_SLOT: Record<string, string> = {
  "1a": "owners_capital",    "1b": "reserves_surplus",
  "2a": "lt_borrowings",     "2b": "deferred_tax_liab",  "2c": "other_lt_liab",     "2d": "lt_provisions",
  "3a": "st_borrowings",     "3b": "trade_payables",     "3c": "other_current_liab", "3d": "st_provisions",
};
const LIAB_ID_TO_DB_SECTION: Record<string, string> = {
  "1a": "liab_owners_funds", "1b": "liab_owners_funds",
  "2a": "liab_non_current",  "2b": "liab_non_current",   "2c": "liab_non_current",  "2d": "liab_non_current",
  "3a": "liab_current",      "3b": "liab_current",       "3c": "liab_current",      "3d": "liab_current",
};

// For save: template id → slot_key (assets side)
const ASSET_ID_TO_SLOT: Record<string, string> = {
  "1a0": "fixed_assets",         "1a": "ppe_intangible",    "1b": "nc_investments",
  "1c":  "deferred_tax_asset",   "1d": "lt_loans_advances", "1e": "other_nc_assets",
  "2cs": "closing_stock",
  "2a":  "current_investments",  "2b": "inventories",       "2c": "trade_receivables",
  "2d":  "cash_bank",            "2e": "st_loans_advances", "2f": "other_current_assets",
};
const ASSET_ID_TO_DB_SECTION: Record<string, string> = {
  "1a0": "asset_non_current", "1a": "asset_non_current", "1b": "asset_non_current",
  "1c":  "asset_non_current", "1d": "asset_non_current", "1e": "asset_non_current",
  "2cs": "asset_current",
  "2a":  "asset_current",     "2b": "asset_current",     "2c": "asset_current",
  "2d":  "asset_current",     "2e": "asset_current",     "2f": "asset_current",
};

// For save: template side + section code → DB section name (dynamic rows only)
const SAVE_DYN_SECTION: Record<string, Record<string, string>> = {
  liabilities: { "2": "liab_non_current",  "3": "liab_current" },
  assets:      { "1": "asset_non_current", "2": "asset_current" },
};

// ─── GET transform: StatementLine[] → BS data ─────────────────

function linesToBS(lines: StatementLine[]): { liabilities: BSRow[]; assets: BSRow[] } {
  const slotMap = new Map<string, StatementLine>();
  const dynBySection = new Map<string, StatementLine[]>();

  for (const line of lines) {
    if (line.slot_key) {
      slotMap.set(line.slot_key, line);
    } else {
      if (!dynBySection.has(line.section)) dynBySection.set(line.section, []);
      dynBySection.get(line.section)!.push(line);
    }
  }
  for (const arr of dynBySection.values()) arr.sort((a, b) => a.sort_order - b.sort_order);

  const buildSide = (template: BSRow[], side: "liabilities" | "assets"): BSRow[] => {
    const idToSlot = side === "liabilities" ? LIAB_ID_TO_SLOT : ASSET_ID_TO_SLOT;
    const result: BSRow[] = [];

    for (const row of template) {
      if (row.type !== "item") {
        // Inject dynamic rows immediately before the add_button for their section
        if (row.type === "add_button" && row.section) {
          const dbSec = SAVE_DYN_SECTION[side]?.[row.section];
          if (dbSec) {
            const dynRows = dynBySection.get(dbSec) ?? [];
            for (const dyn of dynRows) {
              result.push({
                id: `${row.section}_dyn_${dyn.id}`,
                label: dyn.label ?? "",
                type: "item",
                indent: 1,
                section: row.section,
                amount: Number(dyn.amount),
                annexure_ref: dyn.annexure_ref ?? undefined,
                isDynamic: true,
              });
            }
          }
        }
        result.push({ ...row });
        continue;
      }

      // Static item: overlay amount + annexure_ref from DB
      const slotKey = idToSlot[row.id];
      const dbRow = slotKey ? slotMap.get(slotKey) : undefined;
      result.push({
        ...row,
        amount: dbRow ? Number(dbRow.amount) : (row.amount ?? 0),
        annexure_ref: dbRow?.annexure_ref ?? row.annexure_ref,
      });
    }

    return result;
  };

  return {
    liabilities: buildSide(liabilitiesTemplate, "liabilities"),
    assets: buildSide(assetsTemplate, "assets"),
  };
}

// ─── GET transform: StatementLine[] → PLData ─────────────────

function linesToPL(lines: StatementLine[]): PLData {
  const base = getDefaultPLData();
  const slotMap = new Map<string, StatementLine>();
  const dynBySection = new Map<string, StatementLine[]>();

  for (const line of lines) {
    if (line.slot_key) {
      slotMap.set(line.slot_key, line);
    } else {
      if (!dynBySection.has(line.section)) dynBySection.set(line.section, []);
      dynBySection.get(line.section)!.push(line);
    }
  }
  for (const arr of dynBySection.values()) arr.sort((a, b) => a.sort_order - b.sort_order);

  const applySlot = (item: PLItem, slotKey: string): PLItem => {
    const dbRow = slotMap.get(slotKey);
    if (!dbRow) return item;
    return { ...item, amount: Number(dbRow.amount), annexure_ref: dbRow.annexure_ref ?? undefined };
  };

  const dynToItems = (section: string, defaults: PLItem[]): PLItem[] => {
    const rows = dynBySection.get(section);
    if (!rows || rows.length === 0) return defaults;
    return rows.map((r) => ({
      id: `dyn_${r.id}`,
      label: r.label ?? "",
      amount: Number(r.amount),
      annexure_ref: r.annexure_ref ?? undefined,
    }));
  };

  return {
    trading: {
      debit: {
        opening_stock:   applySlot(base.trading.debit.opening_stock, "opening_stock"),
        purchases:       applySlot(base.trading.debit.purchases, "purchases"),
        direct_expenses: dynToItems("trading_debit_direct", base.trading.debit.direct_expenses),
      },
      credit: {
        sales:         applySlot(base.trading.credit.sales, "sales"),
        closing_stock: applySlot(base.trading.credit.closing_stock, "closing_stock"),
        other_income:  dynToItems("trading_credit_other", base.trading.credit.other_income),
      },
    },
    pl: {
      indirect_expenses: dynToItems("pl_debit_indirect", base.pl.indirect_expenses),
      other_income:      dynToItems("pl_credit_other", base.pl.other_income),
    },
  };
}

// ─── SAVE transform: BS data → BulkLine[] ────────────────────

function bsToLines(bsData: { liabilities: BSRow[]; assets: BSRow[] }): BulkLine[] {
  const lines: BulkLine[] = [];
  let dynOrder = 0;

  const processSide = (rows: BSRow[], side: "liabilities" | "assets") => {
    const idToSlot      = side === "liabilities" ? LIAB_ID_TO_SLOT      : ASSET_ID_TO_SLOT;
    const idToDbSection = side === "liabilities" ? LIAB_ID_TO_DB_SECTION : ASSET_ID_TO_DB_SECTION;

    for (const row of rows) {
      if (row.type !== "item") continue;

      if (row.isDynamic) {
        const dbSection = SAVE_DYN_SECTION[side]?.[row.section ?? ""];
        if (!dbSection) continue;
        lines.push({
          section: dbSection, slot_key: null,
          label: row.label ?? null,
          amount: row.amount ?? 0,
          annexure_ref: row.annexure_ref ?? null,
          is_dynamic: true, sort_order: dynOrder++,
        });
      } else {
        const slotKey   = idToSlot[row.id];
        const dbSection = idToDbSection[row.id];
        if (!slotKey || !dbSection) continue;
        lines.push({
          section: dbSection, slot_key: slotKey, label: null,
          amount: row.amount ?? 0,
          annexure_ref: row.annexure_ref ?? null,
          is_dynamic: false, sort_order: 0,
        });
      }
    }
  };

  processSide(bsData.liabilities, "liabilities");
  processSide(bsData.assets, "assets");
  return lines;
}

// ─── SAVE transform: PLData → BulkLine[] ─────────────────────

function plToLines(plData: PLData): BulkLine[] {
  const lines: BulkLine[] = [];

  const addStatic = (item: PLItem, section: string, slotKey: string) => {
    lines.push({
      section, slot_key: slotKey, label: null,
      amount: item.amount ?? 0,
      annexure_ref: item.annexure_ref ?? null,
      is_dynamic: false, sort_order: 0,
    });
  };

  const addDynamic = (items: PLItem[], section: string) => {
    items.forEach((item, i) => {
      lines.push({
        section, slot_key: null,
        label: item.label ?? null,
        amount: item.amount ?? 0,
        annexure_ref: item.annexure_ref ?? null,
        is_dynamic: true, sort_order: i,
      });
    });
  };

  addStatic(plData.trading.debit.opening_stock,    "trading_debit",  "opening_stock");
  addStatic(plData.trading.debit.purchases,         "trading_debit",  "purchases");
  addStatic(plData.trading.credit.sales,            "trading_credit", "sales");
  addStatic(plData.trading.credit.closing_stock,    "trading_credit", "closing_stock");
  addDynamic(plData.trading.debit.direct_expenses,  "trading_debit_direct");
  addDynamic(plData.trading.credit.other_income,    "trading_credit_other");
  addDynamic(plData.pl.indirect_expenses,           "pl_debit_indirect");
  addDynamic(plData.pl.other_income,                "pl_credit_other");

  return lines;
}

// ─── Public API ───────────────────────────────────────────────

export const getStatement = async (fyId: number, type: "balance-sheet" | "profit-loss") => {
  const statementType = type === "balance-sheet" ? "BALANCE_SHEET" : "PROFIT_LOSS";
  const lines: StatementLine[] = await api
    .get(`/financial-years/${fyId}/statement-lines?type=${statementType}`)
    .then((r) => r.data.data);

  if (!lines.length) return null;
  return type === "balance-sheet" ? linesToBS(lines) : linesToPL(lines);
};

export const saveStatement = async (
  fyId: number,
  type: "balance-sheet" | "profit-loss",
  data: any,
) => {
  const statementType = type === "balance-sheet" ? "BALANCE_SHEET" : "PROFIT_LOSS";
  const lines = type === "balance-sheet" ? bsToLines(data) : plToLines(data);
  return api
    .post(`/financial-years/${fyId}/statement-lines/bulk`, { statement_type: statementType, lines })
    .then((r) => r.data);
};

// ─── Annexure API (unchanged) ─────────────────────────────────

export type AnnexureData = {
  id: number;
  ref_code: string;
  title: string;
  ann_type: string;
  data: {
    items?: { name: string; amount: number }[];
    debit?: { name: string; amount: number }[];
    credit?: { name: string; amount: number }[];
  };
};

export const getAnnexures = (fyId: number) =>
  api.get(`/financial-years/${fyId}/annexures`).then((r) => r.data.data as AnnexureData[]);

export const createAnnexure = (fyId: number, payload: { title: string; ann_type?: string; data?: any }) =>
  api.post(`/financial-years/${fyId}/annexures`, payload).then((r) => r.data.data as AnnexureData);

export const updateAnnexure = (id: number, payload: { title?: string; data?: any }) =>
  api.put(`/annexures/${id}`, payload).then((r) => r.data.data as AnnexureData);

export const deleteAnnexure = (id: number) =>
  api.delete(`/annexures/${id}`).then((r) => r.data);

export const projectFY = (fyId: number, growthPercent: number) =>
  api.post(`/financial-years/${fyId}/project`, { growth_percent: growthPercent }).then((r) => r.data.data);

export const reProjectFY = (fyId: number, growthPercent: number) =>
  api.put(`/financial-years/${fyId}/re-project`, { growth_percent: growthPercent }).then((r) => r.data.data);
