import axios from "axios";
import { ensureValidSession, getStoredSession, clearStoredSession } from "./auth";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api/disaster",
  timeout: 30000,
});

API.interceptors.request.use(async (config) => {
  let session = getStoredSession();
  if (session?.refresh_token) {
    session = await ensureValidSession();
  }
  const accessToken = session?.access_token;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (status === 401 && originalRequest && !originalRequest.__isRetry) {
      originalRequest.__isRetry = true;
      const session = await ensureValidSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return API.request(originalRequest);
      }
      clearStoredSession();
    }

    return Promise.reject(error);
  }
);

export const runSimulation = async (payload) => API.post("/simulate", payload);
export const runAssessment = async (payload) => API.post("/assess", payload);

export const getSimulationHistory = async (limit = 10) =>
  API.get("/history", {
    params: { limit },
  });

export const getHistoricalEvents = async () => API.get("/historical-events");

export const getHealthStatus = async () => API.get("/health");

export const dispatchIncident = async (payload) => API.post("/dispatch", payload);

export const sendCitizenAlert = async (payload) => API.post("/alerts/send", payload);
