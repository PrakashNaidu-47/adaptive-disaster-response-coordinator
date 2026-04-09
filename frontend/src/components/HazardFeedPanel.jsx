import React from "react";

import { formatTimestamp, hazardColors } from "../hooks/useHazardFeed";

const HazardFeedPanel = ({ hazards, loading, error, onSelect }) => {
  return (
    <article className="panel hazard-list-panel">
      <div className="panel-header">
        <div>
          <h2>Severe Hazard Feed</h2>
          <p className="hero-copy">
            Click an entry to focus the map and run a live assessment.
          </p>
        </div>
        <div className="hazard-meta">
          <span className="status-label">Sources</span>
          <strong>USGS + NASA EONET</strong>
        </div>
      </div>
      {loading ? <p className="loading-hint">Refreshing live hazards...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="hazard-list">
        {hazards.map((hazard) => {
          const canFocus = Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude);
          return (
            <button
              type="button"
              key={hazard.id}
              className="hazard-row"
              onClick={() => onSelect?.(hazard)}
              disabled={!canFocus}
            >
              <div className="hazard-row-header">
                <span className="hazard-type" style={{ background: hazardColors[hazard.type] }}>
                  {hazard.type}
                </span>
                <strong>{hazard.title}</strong>
              </div>
              <span className="context-note">{hazard.location}</span>
              <div className="hazard-row-meta">
                <span>{hazard.severity}</span>
                <span>{formatTimestamp(hazard.time)}</span>
              </div>
            </button>
          );
        })}
        {!loading && !hazards.length && !error ? (
          <p className="context-note">No active severe hazards found right now.</p>
        ) : null}
      </div>
    </article>
  );
};

export default HazardFeedPanel;
