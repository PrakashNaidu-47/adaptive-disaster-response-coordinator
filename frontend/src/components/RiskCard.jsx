import React from "react";

const RiskCard = ({ situation, meta, title = "Situation Report" }) => {
  if (!situation) {
    return (
      <article className="panel">
        <h2>{title}</h2>
        <p className="muted">No active assessment yet.</p>
      </article>
    );
  }

  const statusClass =
    situation.status === "CRITICAL"
      ? "pill-critical"
      : situation.status === "MODERATE"
        ? "pill-moderate"
        : "pill-stable";

  return (
    <article className="panel">
      <h2>{title}</h2>
      <div className="risk-header">
        <span className={`status-pill ${statusClass}`}>{situation.status}</span>
        <strong>Risk Score: {situation.risk_score}/100</strong>
      </div>
      <p className="location-line">
        {situation.location} ({situation.coordinates.lat.toFixed(3)}, {situation.coordinates.lon.toFixed(3)})
      </p>
      <p>
        {situation.hazards.join(", ")} | {situation.weather_context.description}
      </p>
      <div className="weather-grid">
        <div>
          <span>Temperature</span>
          <strong>{situation.weather_context.temperature_c} C</strong>
        </div>
        <div>
          <span>Wind</span>
          <strong>{situation.weather_context.wind_speed_kmh} km/h</strong>
        </div>
        <div>
          <span>Precipitation</span>
          <strong>{situation.weather_context.precipitation_mm} mm</strong>
        </div>
      </div>
      <div className="weather-grid">
        <div>
          <span>Flood Level</span>
          <strong>{situation.flood_context.level}</strong>
        </div>
        <div>
          <span>River Discharge</span>
          <strong>{situation.flood_context.river_discharge} m3/s</strong>
        </div>
        <div>
          <span>Feed Source</span>
          <strong>{situation.weather_context.source}</strong>
        </div>
      </div>
      {meta?.historical_event_title ? (
        <p className="context-note">Historical scenario: {meta.historical_event_title}</p>
      ) : null}
    </article>
  );
};

export default RiskCard;
