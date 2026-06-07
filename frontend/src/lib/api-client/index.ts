import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/signup") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

export default api;
