import api from "./index";

export type Client = {
  id: number;
  name: string;
  firm_type: string | null;
  pan: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  village: string | null;
  post_office: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  proprietor_name: string | null;
  created_at: string;
  _count?: { financial_years: number };
  financial_years?: FinancialYear[];
};

export type FinancialYear = {
  id: number;
  client_id: number;
  label: string;
  start_date: string;
  end_date: string;
  source_fy_id: number | null;
  growth_percent: number | null;
  created_at: string;
  _count?: Record<string, number>;
};

export const getClients = () =>
  api.get("/clients").then((r) => r.data.data as Client[]);

export const getClient = (id: number) =>
  api.get(`/clients/${id}`).then((r) => r.data.data as Client);

export const createClient = (data: Partial<Client>) =>
  api.post("/clients", data).then((r) => r.data.data as Client);

export const updateClient = (id: number, data: Partial<Client>) =>
  api.patch(`/clients/${id}`, data).then((r) => r.data.data as Client);

export const deleteClient = (id: number) =>
  api.delete(`/clients/${id}`).then((r) => r.data);
