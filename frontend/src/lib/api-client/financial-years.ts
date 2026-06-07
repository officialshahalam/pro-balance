import api from "./index";
import type { FinancialYear } from "./clients";

export const getFinancialYears = (clientId: number) =>
  api.get(`/clients/${clientId}/financial-years`).then((r) => r.data.data as FinancialYear[]);

export const getFinancialYear = (fyId: number) =>
  api.get(`/financial-years/${fyId}`).then((r) => r.data.data as FinancialYear);

export const createFinancialYear = (clientId: number, data: { label: string; start_date: string; end_date: string }) =>
  api.post(`/clients/${clientId}/financial-years`, data).then((r) => r.data.data as FinancialYear);

export const deleteFinancialYear = (fyId: number) =>
  api.delete(`/financial-years/${fyId}`).then((r) => r.data);
