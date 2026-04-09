import axios from "axios";
import { getStoredSession } from "./auth";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api/disaster",
  timeout: 30000,
});

API.interceptors.request.use((config) => {
  const session = getStoredSession();
  const accessToken = session?.access_token;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

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
