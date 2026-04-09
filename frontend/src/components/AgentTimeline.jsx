import React from "react";

const AgentTimeline = ({ thoughts, title = "Agent Reasoning" }) => (
  <article className="panel">
    <h2>{title}</h2>
    {thoughts.length === 0 ? (
      <p className="muted">Run a simulation to inspect autonomous handoff decisions.</p>
    ) : (
      <div className="thought-list">
        {thoughts.map((item) => (
          <div key={item.agent} className="thought-card">
            <h3>{item.agent}</h3>
            <p>{item.summary}</p>
            <ul>
              {item.details.map((detail) => (
                <li key={`${item.agent}-${detail}`}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )}
  </article>
);

export default AgentTimeline;
