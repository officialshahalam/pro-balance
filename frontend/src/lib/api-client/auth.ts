import api from "./index";

export const sendOtpApi = (data: { name: string; email: string; password: string }) =>
  api.post("/auth/send-otp", data).then((r) => r.data.data);

export const verifyOtpApi = (data: { email: string; otp: string }) =>
  api.post("/auth/verify-otp", data).then((r) => r.data.data);

export const loginApi = (data: { email: string; password: string }) =>
  api.post("/auth/login", data).then((r) => r.data.data);

export const logoutApi = () =>
  api.post("/auth/logout").then((r) => r.data);

export const getMeApi = () =>
  api.get("/auth/me").then((r) => r.data.data);
