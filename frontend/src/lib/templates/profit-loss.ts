export type PLItem = {
  id: string;
  label: string;
  amount: number;
  hasAnnexure?: boolean;
  annexure_ref?: string;
};

export type PLData = {
  trading: {
    debit: {
      opening_stock: PLItem;
      purchases: PLItem;
      direct_expenses: PLItem[];
    };
    credit: {
      sales: PLItem;
      closing_stock: PLItem;
      other_income: PLItem[];
    };
  };
  pl: {
    indirect_expenses: PLItem[];
    other_income: PLItem[];
  };
};

export const defaultDirectExpenses: PLItem[] = [
  { id: "de_1", label: "Wages", amount: 0 },
  { id: "de_2", label: "Freight / Carriage Inward", amount: 0 },
  { id: "de_3", label: "Loading & Unloading Charges", amount: 0 },
  { id: "de_4", label: "Manufacturing / Processing Charges", amount: 0 },
  { id: "de_5", label: "Job Work Charges", amount: 0 },
];

export const defaultIndirectExpenses: PLItem[] = [
  { id: "ie_1", label: "Depreciation", amount: 0, hasAnnexure: true },
  { id: "ie_2", label: "Salary Expenses", amount: 0 },
  { id: "ie_3", label: "Rent Expenses", amount: 0 },
  { id: "ie_4", label: "Electricity Expenses", amount: 0 },
  { id: "ie_5", label: "Bank Charges", amount: 0 },
];

export function getDefaultPLData(): PLData {
  return {
    trading: {
      debit: {
        opening_stock: { id: "opening_stock", label: "Opening Stock", amount: 0, hasAnnexure: true },
        purchases: { id: "purchases", label: "Purchases", amount: 0, hasAnnexure: true },
        direct_expenses: defaultDirectExpenses.map((e) => ({ ...e })),
      },
      credit: {
        sales: { id: "sales", label: "By Sales", amount: 0, hasAnnexure: true },
        closing_stock: { id: "closing_stock", label: "By Closing Stock", amount: 0, hasAnnexure: true },
        other_income: [],
      },
    },
    pl: {
      indirect_expenses: defaultIndirectExpenses.map((e) => ({ ...e })),
      other_income: [],
    },
  };
}
