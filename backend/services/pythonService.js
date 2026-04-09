const axios = require("axios");

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

const client = axios.create({
  baseURL: PYTHON_API_URL,
  timeout: 30000,
});

const getAssessmentData = async (payload) => {
  try {
    const response = await client.post("/assess", payload);
    return response.data;
  } catch (error) {
    const reason = error.response?.data?.detail || error.message;
    throw new Error(`AI Engine error: ${reason}`);
  }
};

const getSimulationData = async (payload) => getAssessmentData(payload);

const getHistoricalEvents = async () => {
  try {
    const response = await client.get("/historical-events");
    return response.data.events || [];
  } catch (error) {
    return [];
  }
};

const checkEngineHealth = async () => {
  try {
    const response = await client.get("/health");
    return response.data;
  } catch (error) {
    return { status: "down", detail: error.message };
  }
};

module.exports = {
  getAssessmentData,
  getSimulationData,
  getHistoricalEvents,
  checkEngineHealth,
};
