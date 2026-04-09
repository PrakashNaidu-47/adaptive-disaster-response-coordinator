const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");

const {
  runAssessment,
  runSimulation,
  fetchHistory,
  fetchHistoryById,
  fetchHistoricalEvents,
  healthCheck,
  dispatchIncident,
  sendCitizenAlert,
} = require("../controllers/disasterController");

const router = express.Router();

router.get("/health", healthCheck);
router.use(requireAuth);
router.get("/historical-events", fetchHistoricalEvents);
router.post("/assess", runAssessment);
router.post("/simulate", runSimulation);
router.post("/dispatch", dispatchIncident);
router.post("/alerts/send", sendCitizenAlert);
router.get("/history", fetchHistory);
router.get("/history/:id", fetchHistoryById);

module.exports = router;
