import React from "react";

const SimulationHistory = ({ history, onSelect }) => (
  <section className="panel history-panel">
    <div className="history-header">
      <h2>Assessment History</h2>
      <p>Latest operational assessments saved through MongoDB or the in-memory fallback.</p>
    </div>
    {history.length === 0 ? (
      <p className="muted">No assessment history found yet.</p>
    ) : (
      <div className="history-table">
        {history.map((item) => (
          <button
            key={item.simulationId || item._id}
            type="button"
            className="history-row"
            onClick={() => onSelect(item)}
          >
            <span>{item.location}</span>
            <span>{item.scenarioMode}</span>
            <span>{new Date(item.createdAt).toLocaleString()}</span>
          </button>
        ))}
      </div>
    )}
  </section>
);

export default SimulationHistory;
