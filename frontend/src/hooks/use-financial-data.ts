"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as fd from "@/lib/api-client/financial-data";

// ─── Revenue ─────────────────────────────────────────────
export const useRevenue = (fyId: number) =>
  useQuery({ queryKey: ["revenue", fyId], queryFn: () => fd.getRevenue(fyId) });

export const useCreateRevenue = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; amount: number }) => fd.createRevenue(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", fyId] }),
  });
};

export const useUpdateRevenue = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; amount?: number }) => fd.updateRevenue(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", fyId] }),
  });
};

export const useBulkCreateRevenue = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; amount: number }[]) => fd.bulkCreateRevenue(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", fyId] }),
  });
};

export const useBatchUpdateRevenue = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: number; name: string; amount: number }[]) => fd.batchUpdateRevenue(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", fyId] }),
  });
};

export const useDeleteRevenue = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fd.deleteRevenue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", fyId] }),
  });
};

// ─── Purchases ───────────────────────────────────────────
export const usePurchases = (fyId: number) =>
  useQuery({ queryKey: ["purchases", fyId], queryFn: () => fd.getPurchases(fyId) });

export const useUpsertPurchases = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { opening_stock?: number; purchases?: number; closing_stock?: number }) => fd.upsertPurchases(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchases", fyId] }),
  });
};

// ─── Expenses ────────────────────────────────────────────
export const useExpenses = (fyId: number, type?: string) =>
  useQuery({ queryKey: ["expenses", fyId, type], queryFn: () => fd.getExpenses(fyId, type) });

export const useCreateExpense = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; amount: number; type: string }) => fd.createExpense(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", fyId] }),
  });
};

export const useUpdateExpense = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; amount?: number }) => fd.updateExpense(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", fyId] }),
  });
};

export const useBulkCreateExpense = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; amount: number; type: string }[]) => fd.bulkCreateExpense(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", fyId] }),
  });
};

export const useBatchUpdateExpense = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: number; name: string; amount: number }[]) => fd.batchUpdateExpense(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", fyId] }),
  });
};

export const useDeleteExpense = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fd.deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", fyId] }),
  });
};

// ─── Fixed Assets ────────────────────────────────────────
export const useFixedAssets = (fyId: number) =>
  useQuery({ queryKey: ["fixed-assets", fyId], queryFn: () => fd.getFixedAssets(fyId) });

export const useCreateFixedAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => fd.createFixedAsset(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-assets", fyId] }),
  });
};

export const useUpdateFixedAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) => fd.updateFixedAsset(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-assets", fyId] }),
  });
};

export const useBatchUpdateFixedAssets = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Record<string, unknown>[]) => fd.batchUpdateFixedAssets(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-assets", fyId] }),
  });
};

export const useDeleteFixedAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fd.deleteFixedAsset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed-assets", fyId] }),
  });
};

// ─── Capital ─────────────────────────────────────────────
export const useCapital = (fyId: number) =>
  useQuery({ queryKey: ["capital", fyId], queryFn: () => fd.getCapital(fyId) });

export const useUpsertCapital = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { opening_balance?: number; additions?: number; drawings?: number }) => fd.upsertCapital(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capital", fyId] }),
  });
};

// ─── Loans ───────────────────────────────────────────────
export const useLoans = (fyId: number) =>
  useQuery({ queryKey: ["loans", fyId], queryFn: () => fd.getLoans(fyId) });

export const useCreateLoan = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => fd.createLoan(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans", fyId] }),
  });
};

export const useUpdateLoan = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) => fd.updateLoan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans", fyId] }),
  });
};

export const useBatchUpdateLoans = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Record<string, unknown>[]) => fd.batchUpdateLoans(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans", fyId] }),
  });
};

export const useDeleteLoan = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fd.deleteLoan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans", fyId] }),
  });
};

// ─── Current Liabilities ─────────────────────────────────
export const useCurrentLiabilities = (fyId: number) =>
  useQuery({ queryKey: ["current-liabilities", fyId], queryFn: () => fd.getCurrentLiabilities(fyId) });

export const useCreateCurrentLiability = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; amount: number }) => fd.createCurrentLiability(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-liabilities", fyId] }),
  });
};

export const useUpdateCurrentLiability = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; amount?: number }) => fd.updateCurrentLiability(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-liabilities", fyId] }),
  });
};

export const useBulkCreateCurrentLiability = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; amount: number }[]) => fd.bulkCreateCurrentLiability(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-liabilities", fyId] }),
  });
};

export const useBatchUpdateCurrentLiability = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: number; name: string; amount: number }[]) => fd.batchUpdateCurrentLiability(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-liabilities", fyId] }),
  });
};

export const useDeleteCurrentLiability = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fd.deleteCurrentLiability(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-liabilities", fyId] }),
  });
};

// ─── Current Assets ──────────────────────────────────────
export const useCurrentAssets = (fyId: number) =>
  useQuery({ queryKey: ["current-assets", fyId], queryFn: () => fd.getCurrentAssets(fyId) });

export const useCreateCurrentAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; amount: number }) => fd.createCurrentAsset(fyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-assets", fyId] }),
  });
};

export const useUpdateCurrentAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; amount?: number }) => fd.updateCurrentAsset(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-assets", fyId] }),
  });
};

export const useBulkCreateCurrentAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; amount: number }[]) => fd.bulkCreateCurrentAsset(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-assets", fyId] }),
  });
};

export const useBatchUpdateCurrentAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: number; name: string; amount: number }[]) => fd.batchUpdateCurrentAsset(fyId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-assets", fyId] }),
  });
};

export const useDeleteCurrentAsset = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fd.deleteCurrentAsset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["current-assets", fyId] }),
  });
};
