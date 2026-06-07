export type BSRow = {
  id: string;
  label: string;
  type: "header" | "subheader" | "item" | "subtotal" | "total" | "add_button";
  indent?: number;
  annexure_ref?: string;
  amount?: number;
  isDynamic?: boolean;
  section?: string;
};

export const DYNAMIC_SECTIONS = {
  liabilities: ["2", "3"],
  assets: ["1", "2"],
};

export const liabilitiesTemplate: BSRow[] = [
  { id: "I", label: "EQUITY AND LIABILITIES", type: "header" },
  { id: "1", label: "Owners' Funds", type: "subheader" },
  { id: "1a", label: "Owners' Capital Account", type: "item", indent: 1 },
  { id: "1b", label: "Reserves and surplus", type: "item", indent: 1 },
  { id: "1_sub", label: "", type: "subtotal" },
  { id: "2", label: "Non-current liabilities", type: "subheader" },
  { id: "2a", label: "Long-term borrowings", type: "item", indent: 1, section: "2" },
  { id: "2b", label: "Deferred tax liabilities (Net)", type: "item", indent: 1, section: "2" },
  { id: "2c", label: "Other long-term liabilities", type: "item", indent: 1, section: "2" },
  { id: "2d", label: "Long-term provisions", type: "item", indent: 1, section: "2" },
  { id: "2_add", label: "Add", type: "add_button", section: "2" },
  { id: "2_sub", label: "", type: "subtotal" },
  { id: "3", label: "Current liabilities", type: "subheader" },
  { id: "3a", label: "Short-term borrowings", type: "item", indent: 1, section: "3" },
  { id: "3b", label: "Trade payables", type: "item", indent: 1, section: "3" },
  { id: "3c", label: "Other current liabilities", type: "item", indent: 1, section: "3" },
  { id: "3d", label: "Short-term provisions", type: "item", indent: 1, section: "3" },
  { id: "3_add", label: "Add", type: "add_button", section: "3" },
  { id: "3_sub", label: "", type: "subtotal" },
  { id: "total", label: "Total", type: "total" },
];

export const assetsTemplate: BSRow[] = [
  { id: "II", label: "ASSETS", type: "header" },
  { id: "1", label: "Non-current assets", type: "subheader" },
  { id: "1a0", label: "Fixed Assets", type: "item", indent: 1, section: "1" },
  { id: "1a", label: "Property, Plant and Equipment and Intangible assets", type: "item", indent: 1, section: "1" },
  { id: "1b", label: "Non-current investments", type: "item", indent: 1, section: "1" },
  { id: "1c", label: "Deferred tax assets (Net)", type: "item", indent: 1, section: "1" },
  { id: "1d", label: "Long Term Loans and Advances", type: "item", indent: 1, section: "1" },
  { id: "1e", label: "Other non-current assets", type: "item", indent: 1, section: "1" },
  { id: "1_add", label: "Add", type: "add_button", section: "1" },
  { id: "1_sub", label: "", type: "subtotal" },
  { id: "2", label: "Current assets", type: "subheader" },
  { id: "2a", label: "Current investments", type: "item", indent: 1, section: "2" },
  { id: "2b", label: "Inventories", type: "item", indent: 1, section: "2" },
  { id: "2c", label: "Trade receivables", type: "item", indent: 1, section: "2" },
  { id: "2d", label: "Cash and bank balances", type: "item", indent: 1, section: "2" },
  { id: "2e", label: "Short Term Loans and Advances", type: "item", indent: 1, section: "2" },
  { id: "2f", label: "Other current assets", type: "item", indent: 1, section: "2" },
  { id: "2_add", label: "Add", type: "add_button", section: "2" },
  { id: "2_sub", label: "", type: "subtotal" },
  { id: "total", label: "Total", type: "total" },
];

export function getDefaultBSData() {
  return {
    liabilities: liabilitiesTemplate.map((r) => ({ ...r, amount: r.type === "item" ? 0 : undefined })),
    assets: assetsTemplate.map((r) => ({ ...r, amount: r.type === "item" ? 0 : undefined })),
  };
}
