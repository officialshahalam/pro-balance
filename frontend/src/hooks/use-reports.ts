"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as reportsApi from "@/lib/api-client/reports";

export const useReports = (fyId: number) =>
  useQuery({ queryKey: ["reports", fyId], queryFn: () => reportsApi.getReports(fyId) });

export const useReport = (id: number) =>
  useQuery({ queryKey: ["report", id], queryFn: () => reportsApi.getReport(id), enabled: !!id });

export const useGenerateReport = (fyId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: string) => reportsApi.generateReport(fyId, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", fyId] }),
  });
};

export const useFinalizeReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reportsApi.finalizeReport(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["report", data.id] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
};
