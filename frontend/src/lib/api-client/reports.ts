import api from "./index";

export type Report = {
  id: number;
  type: "BALANCE_SHEET" | "PROFIT_AND_LOSS";
  status: "PROJECTED" | "ACTUAL";
  snapshot: Record<string, unknown>;
  generated_at: string;
  finalized_at: string | null;
  created_at: string;
};

export const getReports = (fyId: number) =>
  api.get(`/financial-years/${fyId}/reports`).then((r) => r.data.data as Report[]);

export const getReport = (id: number) =>
  api.get(`/reports/${id}`).then((r) => r.data.data as Report);

export const generateReport = (fyId: number, type: string) =>
  api.post(`/financial-years/${fyId}/reports/generate`, { type }).then((r) => r.data.data as Report);

export const finalizeReport = (id: number) =>
  api.patch(`/reports/${id}/finalize`).then((r) => r.data.data as Report);

export const exportReportPdf = (id: number) =>
  api.get(`/reports/${id}/export/pdf`, { responseType: "blob" }).then((r) => r.data);

export const exportReportXlsx = (id: number) =>
  api.get(`/reports/${id}/export/xlsx`, { responseType: "blob" }).then((r) => r.data);
