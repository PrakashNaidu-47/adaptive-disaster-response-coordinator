import React, { useMemo, useState } from "react";

import AgentTimeline from "../components/AgentTimeline";
import RiskCard from "../components/RiskCard";
import { runAssessment } from "../services/api";

const DEFAULT_FORM = {
  location: "Tirupati, Andhra Pradesh, India",
  population: 20000,
  incidentLabel: "Mock flood drill",
  scenarioMode: "mock",
};

const SimulationPage = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topologyNodes = useMemo(
    () => [
      { title: "Situation Agent", subtitle: "Risk detection" },
      { title: "Resource Agent", subtitle: "Asset allocation" },
      { title: "Evacuation Agent", subtitle: "Route planning" },
      { title: "Coordinator", subtitle: "Unified response" },
    ],
    []
  );

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleRun = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await runAssessment({
        location: form.location,
        scenario_mode: form.scenarioMode,
        population: Number(form.population) || 20000,
        incident_label: form.incidentLabel || null,
        blocked_road_ids: [],
        search_radius_km: 10,
      });
      setResult(response.data?.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <section className="hero">
        <p className="hero-eyebrow">Agent Simulation & Reasoning</p>
        <h1>Transparent autonomous decisioning</h1>
        <p className="hero-copy">
          Run hypothetical scenarios to review handoffs, agent reasoning, and the chain of
          coordinated actions.
        </p>
      </section>

      <section className="simulation-grid">
        <article className="panel">
          <h2>Simulation Runner</h2>
          <div className="form-grid">
            <label>
              Scenario location
              <input
                type="text"
                value={form.location}
                onChange={(event) => handleChange("location", event.target.value)}
                placeholder="City, district, or command zone"
              />
            </label>
            <label>
              Population at risk
              <input
                type="number"
                value={form.population}
                onChange={(event) => handleChange("population", event.target.value)}
                min="1000"
              />
            </label>
            <label>
              Incident label
              <input
                type="text"
                value={form.incidentLabel}
                onChange={(event) => handleChange("incidentLabel", event.target.value)}
                placeholder="e.g. Cyclone staging drill"
              />
            </label>
            <label>
              Simulation mode
              <select
                value={form.scenarioMode}
                onChange={(event) => handleChange("scenarioMode", event.target.value)}
              >
                <option value="mock">Mock scenario</option>
                <option value="historical">Historical replay</option>
              </select>
            </label>
            <button type="button" onClick={handleRun} disabled={loading}>
              {loading ? "Running Simulation..." : "Run Simulation"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </div>
        </article>

        <article className="panel topology-panel">
          <h2>Multi-Agent Topology</h2>
          <div className="topology-flow">
            {topologyNodes.map((node, index) => (
              <div key={node.title} className="topology-node">
                <strong>{node.title}</strong>
                <span>{node.subtitle}</span>
                {index < topologyNodes.length - 1 ? <div className="topology-connector" /> : null}
              </div>
            ))}
          </div>
          <p className="context-note">
            The topology highlights the chain of command during simulated handoffs.
          </p>
        </article>
      </section>

      <section className="results-grid">
        <RiskCard
          title="Simulation Situation Report"
          situation={result?.situation}
          meta={result?.meta}
        />
        <AgentTimeline title="Agent Decision Logs" thoughts={result?.agent_thoughts || []} />
      </section>
    </div>
  );
};

export default SimulationPage;

