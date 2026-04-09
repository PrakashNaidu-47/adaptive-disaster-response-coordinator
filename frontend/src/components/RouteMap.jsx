import React from "react";

const RouteMap = ({ routes, title = "Operational Routes" }) => (
  <article className="panel">
    <h2>{title}</h2>
    {routes.length === 0 ? (
      <p className="muted">No route recommendations generated yet.</p>
    ) : (
      <div className="route-list">
        {routes.map((route) => (
          <div className="route-card" key={route.id}>
            <h3>{route.destination_name || route.shelter_name}</h3>
            <p>{route.path_summary || route.path_nodes?.join(" -> ") || "Route available"}</p>
            <div className="route-stats">
              <span>{route.distance_km} km</span>
              <span>{route.eta_min} min ETA</span>
              <span>
                Traffic Delay {route.traffic_delay_min ?? route.risk_penalty ?? 0}
                {route.traffic_delay_min != null ? " min" : ""}
              </span>
            </div>
            <p className="context-note">{route.source}</p>
          </div>
        ))}
      </div>
    )}
  </article>
);

export default RouteMap;
