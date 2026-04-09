const {
  getAssessmentData,
  getSimulationData,
  getHistoricalEvents,
  checkEngineHealth,
} = require("../services/pythonService");
const { createPagerDutyIncident } = require("../services/dispatchService");
const { sendSmsAlert } = require("../services/notificationService");
const {
  saveSimulation,
  listSimulations,
  getSimulationById,
} = require("../services/simulationStore");

const parseBlockedRoads = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const runAssessment = async (req, res) => {
  const {
    location,
    latitude = null,
    longitude = null,
    scenario_mode = "live",
    historical_event_id = null,
    population = 20000,
    blocked_road_ids = [],
    search_radius_km = 8,
    incident_label = null,
    target_language = "en",
  } = req.body;

  if (!location || String(location).trim().length < 2) {
    return res.status(400).json({ success: false, message: "Location is required." });
  }

  const allowedModes = new Set(["live", "historical", "mock"]);
  if (!allowedModes.has(String(scenario_mode))) {
    return res.status(400).json({
      success: false,
      message: "scenario_mode must be one of: live, historical, mock",
    });
  }

  const payload = {
    location: String(location).trim(),
    latitude: latitude == null ? null : Number(latitude),
    longitude: longitude == null ? null : Number(longitude),
    scenario_mode: String(scenario_mode),
    historical_event_id: historical_event_id ? String(historical_event_id) : null,
    population: Math.max(1000, Math.min(Number(population) || 20000, 3000000)),
    blocked_road_ids: parseBlockedRoads(blocked_road_ids),
    search_radius_km: Math.max(1, Math.min(Number(search_radius_km) || 8, 30)),
    incident_label: incident_label ? String(incident_label) : null,
    target_language: String(target_language || "en"),
  };

  try {
    const startTime = Date.now();
    const aiData = await getAssessmentData(payload);
    const latencyMs = Date.now() - startTime;
    aiData.meta = {
      ...(aiData.meta || {}),
      gateway_latency_ms: latencyMs,
      gateway_received_at: new Date().toISOString(),
    };
    await saveSimulation({
      simulationId: aiData.simulation_id,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      request: payload,
      response: aiData,
      scenarioMode: payload.scenario_mode,
      location: payload.location,
    });

    return res.status(200).json({ success: true, data: aiData });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message });
  }
};

const runSimulation = async (req, res) => runAssessment(req, res);

const fetchHistory = async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 100));
  try {
    const runs = await listSimulations(limit, req.user.id);
    return res.status(200).json({ success: true, data: runs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const fetchHistoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const run = await getSimulationById(id, req.user.id);
    if (!run) {
      return res.status(404).json({ success: false, message: "Assessment not found." });
    }
    return res.status(200).json({ success: true, data: run });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const fetchHistoricalEvents = async (_req, res) => {
  try {
    const events = await getHistoricalEvents();
    return res.status(200).json({ success: true, data: events });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const healthCheck = async (_req, res) => {
  const aiEngine = await checkEngineHealth();
  return res.status(200).json({
    success: true,
    data: {
      gateway: "ok",
      ai_engine: aiEngine,
      timestamp: new Date().toISOString(),
    },
  });
};

const dispatchIncident = async (req, res) => {
  const { assessment_id, title, summary, urgency = "high" } = req.body;

  try {
    let resolvedTitle = title;
    let resolvedSummary = summary;

    if (assessment_id && (!resolvedTitle || !resolvedSummary)) {
      const assessment = await getSimulationById(assessment_id, req.user.id);
      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
      }
      const response = assessment.response || {};
      resolvedTitle =
        resolvedTitle ||
        response.meta?.incident_label ||
        `Incident - ${response.situation?.location || assessment.location}`;
      resolvedSummary =
        resolvedSummary ||
        [
          `Status: ${response.situation?.status || "unknown"}`,
          `Risk score: ${response.situation?.risk_score || "n/a"}`,
          `Hazards: ${(response.situation?.hazards || []).join(", ") || "n/a"}`,
          `Recommended actions: ${(response.recommended_actions || []).join(" | ") || "n/a"}`,
        ].join("\n");
    }

    if (!resolvedTitle || !resolvedSummary) {
      return res.status(400).json({
        success: false,
        message: "Provide either assessment_id or both title and summary.",
      });
    }

    const incident = await createPagerDutyIncident({
      title: resolvedTitle,
      summary: resolvedSummary,
      urgency,
    });
    return res.status(200).json({ success: true, data: incident });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message });
  }
};

const sendCitizenAlert = async (req, res) => {
  const {
    recipients = [],
    message,
    target_language = "en",
    assessment_id = null,
  } = req.body;

  const normalizedRecipients = Array.isArray(recipients)
    ? recipients.map((item) => String(item).trim()).filter(Boolean)
    : [];

  try {
    let body = message;
    if (!body && assessment_id) {
      const assessment = await getSimulationById(assessment_id, req.user.id);
      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
      }
      const response = assessment.response || {};
      body = [
        `Alert for ${response.situation?.location || assessment.location}.`,
        `Status: ${response.situation?.status || "unknown"}.`,
        `Hazards: ${(response.situation?.hazards || []).join(", ") || "none"}.`,
        (response.recommended_actions || [])[0] || "Follow district authority guidance immediately.",
      ].join(" ");
    }

    if (!body || normalizedRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide recipients and either message or assessment_id.",
      });
    }

    const result = await sendSmsAlert({
      recipients: normalizedRecipients,
      body,
      targetLanguage: target_language,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message });
  }
};

module.exports = {
  runAssessment,
  runSimulation,
  fetchHistory,
  fetchHistoryById,
  fetchHistoricalEvents,
  healthCheck,
  dispatchIncident,
  sendCitizenAlert,
};
