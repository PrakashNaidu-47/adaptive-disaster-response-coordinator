const mongoose = require("mongoose");

const simulationRunSchema = new mongoose.Schema(
  {
    simulationId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    ownerEmail: { type: String, required: true },
    request: { type: Object, required: true },
    response: { type: Object, required: true },
    scenarioMode: { type: String, required: true, default: "live" },
    location: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SimulationRun", simulationRunSchema);
