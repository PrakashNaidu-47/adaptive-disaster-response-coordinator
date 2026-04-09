const mongoose = require("mongoose");

const SimulationRun = require("../models/SimulationRun");

const memoryStore = [];

const canUseMongo = () => mongoose.connection.readyState === 1;

const saveSimulation = async ({
  simulationId,
  ownerId,
  ownerEmail,
  request,
  response,
  scenarioMode,
  location,
}) => {
  if (canUseMongo()) {
    const record = await SimulationRun.create({
      simulationId,
      ownerId,
      ownerEmail,
      request,
      response,
      scenarioMode,
      location,
    });
    return normalizeDoc(record);
  }

  const inMemory = {
    _id: simulationId,
    simulationId,
    ownerId,
    ownerEmail,
    request,
    response,
    scenarioMode,
    location,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memoryStore.unshift(inMemory);
  return inMemory;
};

const listSimulations = async (limit = 10, ownerId) => {
  if (canUseMongo()) {
    const docs = await SimulationRun.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(normalizeDoc);
  }

  return memoryStore.filter((item) => item.ownerId === ownerId).slice(0, limit);
};

const getSimulationById = async (id, ownerId) => {
  if (canUseMongo()) {
    const doc = await SimulationRun.findOne({
      ownerId,
      $or: [{ _id: id }, { simulationId: id }],
    }).lean();
    return doc ? normalizeDoc(doc) : null;
  }

  return (
    memoryStore.find(
      (item) => item.ownerId === ownerId && (item.simulationId === id || item._id === id)
    ) || null
  );
};

const normalizeDoc = (doc) => ({
  _id: doc._id?.toString?.() || doc._id,
  simulationId: doc.simulationId,
  request: doc.request,
  response: doc.response,
  scenarioMode: doc.scenarioMode,
  location: doc.location,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

module.exports = {
  saveSimulation,
  listSimulations,
  getSimulationById,
};
