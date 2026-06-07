import api from "./index";

// ─── Revenue ─────────────────────────────────────────────
export type RevenueHead = { id: number; name: string; amount: string; sort_order: number };

export const getRevenue = (fyId: number) =>
  api.get(`/financial-years/${fyId}/revenue`).then((r) => r.data.data as RevenueHead[]);
export const createRevenue = (fyId: number, data: { name: string; amount: number }) =>
  api.post(`/financial-years/${fyId}/revenue`, data).then((r) => r.data.data);
export const updateRevenue = (id: number, data: { name?: string; amount?: number }) =>
  api.patch(`/revenue/${id}`, data).then((r) => r.data.data);
export const deleteRevenue = (id: number) =>
  api.delete(`/revenue/${id}`).then((r) => r.data);
export const bulkCreateRevenue = (fyId: number, items: { name: string; amount: number }[]) =>
  api.post(`/financial-years/${fyId}/revenue/bulk`, { items }).then((r) => r.data.data);
export const batchUpdateRevenue = (fyId: number, items: { id: number; name: string; amount: number }[]) =>
  api.put(`/financial-years/${fyId}/revenue/batch`, { items }).then((r) => r.data.data);
export const reorderRevenue = (fyId: number, orderedIds: number[]) =>
  api.patch(`/financial-years/${fyId}/revenue/reorder`, { orderedIds }).then((r) => r.data);

// ─── Purchases ───────────────────────────────────────────
export type PurchaseInventory = { id: number; opening_stock: string; purchases: string; closing_stock: string };

export const getPurchases = (fyId: number) =>
  api.get(`/financial-years/${fyId}/purchases`).then((r) => r.data.data as PurchaseInventory | null);
export const upsertPurchases = (fyId: number, data: { opening_stock?: number; purchases?: number; closing_stock?: number }) =>
  api.put(`/financial-years/${fyId}/purchases`, data).then((r) => r.data.data);

// ─── Expenses ────────────────────────────────────────────
export type ExpenseHead = { id: number; name: string; amount: string; type: "DIRECT" | "INDIRECT"; sort_order: number };

export const getExpenses = (fyId: number, type?: string) =>
  api.get(`/financial-years/${fyId}/expenses`, { params: type ? { type } : {} }).then((r) => r.data.data as ExpenseHead[]);
export const createExpense = (fyId: number, data: { name: string; amount: number; type: string }) =>
  api.post(`/financial-years/${fyId}/expenses`, data).then((r) => r.data.data);
export const updateExpense = (id: number, data: { name?: string; amount?: number; type?: string }) =>
  api.patch(`/expenses/${id}`, data).then((r) => r.data.data);
export const deleteExpense = (id: number) =>
  api.delete(`/expenses/${id}`).then((r) => r.data);
export const bulkCreateExpense = (fyId: number, items: { name: string; amount: number; type: string }[]) =>
  api.post(`/financial-years/${fyId}/expenses/bulk`, { items }).then((r) => r.data.data);
export const batchUpdateExpense = (fyId: number, items: { id: number; name: string; amount: number }[]) =>
  api.put(`/financial-years/${fyId}/expenses/batch`, { items }).then((r) => r.data.data);

// ─── Fixed Assets ────────────────────────────────────────
export type FixedAsset = {
  id: number; name: string; category: string;
  opening_wdv: string; additions: string; deletions: string;
  depreciation_rate: string; depreciation_amount: string; closing_wdv: string;
  sort_order: number;
};

export const getFixedAssets = (fyId: number) =>
  api.get(`/financial-years/${fyId}/fixed-assets`).then((r) => r.data.data as FixedAsset[]);
export const createFixedAsset = (fyId: number, data: Record<string, unknown>) =>
  api.post(`/financial-years/${fyId}/fixed-assets`, data).then((r) => r.data.data);
export const updateFixedAsset = (id: number, data: Record<string, unknown>) =>
  api.patch(`/fixed-assets/${id}`, data).then((r) => r.data.data);
export const deleteFixedAsset = (id: number) =>
  api.delete(`/fixed-assets/${id}`).then((r) => r.data);
export const bulkCreateFixedAssets = (fyId: number, items: Record<string, unknown>[]) =>
  api.post(`/financial-years/${fyId}/fixed-assets/bulk`, { items }).then((r) => r.data.data);
export const batchUpdateFixedAssets = (fyId: number, items: Record<string, unknown>[]) =>
  api.put(`/financial-years/${fyId}/fixed-assets/batch`, { items }).then((r) => r.data.data);

// ─── Capital Account ─────────────────────────────────────
export type CapitalAccount = { id: number; opening_balance: string; additions: string; drawings: string };

export const getCapital = (fyId: number) =>
  api.get(`/financial-years/${fyId}/capital`).then((r) => r.data.data as CapitalAccount | null);
export const upsertCapital = (fyId: number, data: { opening_balance?: number; additions?: number; drawings?: number }) =>
  api.put(`/financial-years/${fyId}/capital`, data).then((r) => r.data.data);

// ─── Loans ───────────────────────────────────────────────
export type Loan = {
  id: number; name: string; opening_balance: string; interest_rate: string;
  emi: string; tenure_months: number | null;
  interest_expense: string; principal_repaid: string; closing_balance: string;
};

export const getLoans = (fyId: number) =>
  api.get(`/financial-years/${fyId}/loans`).then((r) => r.data.data as Loan[]);
export const createLoan = (fyId: number, data: Record<string, unknown>) =>
  api.post(`/financial-years/${fyId}/loans`, data).then((r) => r.data.data);
export const updateLoan = (id: number, data: Record<string, unknown>) =>
  api.patch(`/loans/${id}`, data).then((r) => r.data.data);
export const deleteLoan = (id: number) =>
  api.delete(`/loans/${id}`).then((r) => r.data);
export const bulkCreateLoans = (fyId: number, items: Record<string, unknown>[]) =>
  api.post(`/financial-years/${fyId}/loans/bulk`, { items }).then((r) => r.data.data);
export const batchUpdateLoans = (fyId: number, items: Record<string, unknown>[]) =>
  api.put(`/financial-years/${fyId}/loans/batch`, { items }).then((r) => r.data.data);

// ─── Current Liabilities ─────────────────────────────────
export type CurrentLiability = { id: number; name: string; amount: string; sort_order: number };

export const getCurrentLiabilities = (fyId: number) =>
  api.get(`/financial-years/${fyId}/current-liabilities`).then((r) => r.data.data as CurrentLiability[]);
export const createCurrentLiability = (fyId: number, data: { name: string; amount: number }) =>
  api.post(`/financial-years/${fyId}/current-liabilities`, data).then((r) => r.data.data);
export const updateCurrentLiability = (id: number, data: { name?: string; amount?: number }) =>
  api.patch(`/current-liabilities/${id}`, data).then((r) => r.data.data);
export const deleteCurrentLiability = (id: number) =>
  api.delete(`/current-liabilities/${id}`).then((r) => r.data);
export const bulkCreateCurrentLiability = (fyId: number, items: { name: string; amount: number }[]) =>
  api.post(`/financial-years/${fyId}/current-liabilities/bulk`, { items }).then((r) => r.data.data);
export const batchUpdateCurrentLiability = (fyId: number, items: { id: number; name: string; amount: number }[]) =>
  api.put(`/financial-years/${fyId}/current-liabilities/batch`, { items }).then((r) => r.data.data);

// ─── Current Assets ──────────────────────────────────────
export type CurrentAsset = { id: number; name: string; amount: string; sort_order: number };

export const getCurrentAssets = (fyId: number) =>
  api.get(`/financial-years/${fyId}/current-assets`).then((r) => r.data.data as CurrentAsset[]);
export const createCurrentAsset = (fyId: number, data: { name: string; amount: number }) =>
  api.post(`/financial-years/${fyId}/current-assets`, data).then((r) => r.data.data);
export const updateCurrentAsset = (id: number, data: { name?: string; amount?: number }) =>
  api.patch(`/current-assets/${id}`, data).then((r) => r.data.data);
export const deleteCurrentAsset = (id: number) =>
  api.delete(`/current-assets/${id}`).then((r) => r.data);
export const bulkCreateCurrentAsset = (fyId: number, items: { name: string; amount: number }[]) =>
  api.post(`/financial-years/${fyId}/current-assets/bulk`, { items }).then((r) => r.data.data);
export const batchUpdateCurrentAsset = (fyId: number, items: { id: number; name: string; amount: number }[]) =>
  api.put(`/financial-years/${fyId}/current-assets/batch`, { items }).then((r) => r.data.data);
