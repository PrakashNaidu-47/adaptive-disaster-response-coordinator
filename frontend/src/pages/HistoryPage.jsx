import React, { useEffect, useMemo, useState } from "react";

import { getSimulationHistory } from "../services/api";
import { useAssessment } from "../state/AssessmentContext";

const formatDate = (value) => {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
};

const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const HistoryPage = () => {
  const { history, setHistory } = useAssessment();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getSimulationHistory(50);
        setHistory(response.data?.data || []);
      } catch (loadError) {
        setError(loadError.response?.data?.message || loadError.message);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [setHistory]);

  const filteredHistory = useMemo(() => {
    return (history || [])
      .filter((item) => {
        const status = item.response?.situation?.status || "UNKNOWN";
        if (statusFilter !== "ALL" && status !== statusFilter) {
          return false;
        }
        if (!query.trim()) return true;
        const needle = query.toLowerCase();
        return (
          String(item.location || "").toLowerCase().includes(needle) ||
          String(item.response?.situation?.location || "").toLowerCase().includes(needle) ||
          String(item.simulationId || "").toLowerCase().includes(needle)
        );
      });
  }, [history, query, statusFilter]);

  const analytics = useMemo(() => {
    const counts = { CRITICAL: 0, MODERATE: 0, STABLE: 0, UNKNOWN: 0 };
    const locationCounts = {};
    const latencies = [];
    let highConfidence = 0;

    (history || []).forEach((item) => {
      const status = item.response?.situation?.status || "UNKNOWN";
      counts[status] = (counts[status] || 0) + 1;

      const location = item.location || item.response?.situation?.location || "Unknown";
      locationCounts[location] = (locationCounts[location] || 0) + 1;

      const latency = item.response?.meta?.gateway_latency_ms;
      if (typeof latency === "number") {
        latencies.push(latency);
      }

      if (item.response?.meta?.data_quality === "high") {
        highConfidence += 1;
      }
    });

    const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totalRuns = history.length || 0;
    const latencyAvg =
      latencies.length > 0 ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    const latencySorted = [...latencies].sort((a, b) => a - b);
    const latencyMedian =
      latencySorted.length > 0
        ? latencySorted[Math.floor(latencySorted.length / 2)]
        : null;
    const accuracyProxy = totalRuns ? Math.round((highConfidence / totalRuns) * 100) : null;

    return {
      counts,
      sortedLocations,
      latencyAvg,
      latencyMedian,
      accuracyProxy,
      totalRuns,
    };
  }, [history]);

  const handleExportCsv = () => {
    const header = [
      "Assessment ID",
      "Location",
      "Status",
      "Risk Score",
      "Scenario Mode",
      "Generated At",
      "Saved At",
    ];
    const rows = (history || []).map((item) => [
      item.simulationId,
      item.response?.situation?.location || item.location,
      item.response?.situation?.status || "UNKNOWN",
      item.response?.situation?.risk_score ?? "n/a",
      item.response?.meta?.scenario_mode || item.scenarioMode || "live",
      item.response?.generated_at || "n/a",
      item.createdAt || "n/a",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadFile(csv, "assessment-history.csv", "text/csv;charset=utf-8;");
  };

  const handleExportJson = () => {
    downloadFile(JSON.stringify(history, null, 2), "assessment-history.json", "application/json");
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const maxCount = Math.max(1, ...Object.values(analytics.counts));

  return (
    <div className="dashboard-page">
      <section className="hero">
        <p className="hero-eyebrow">Assessment History & Analytics</p>
        <h1>Audit, export, and analyze response performance</h1>
        <p className="hero-copy">
          Filter historical runs, export reports for audits, and monitor AI performance indicators.
        </p>
      </section>

      <section className="panel">
        <div className="history-controls">
          <div className="form-grid">
            <label>
              Search location or assessment ID
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Tirupati"
              />
            </label>
          </div>
          <div className="filter-row">
            <label>
              Status filter
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="CRITICAL">Critical</option>
                <option value="MODERATE">Moderate</option>
                <option value="STABLE">Stable</option>
              </select>
            </label>
            <div className="export-row">
              <button type="button" onClick={handleExportCsv}>
                Export CSV
              </button>
              <button type="button" onClick={handleExportJson}>
                Export JSON
              </button>
              <button type="button" className="ghost-button" onClick={handlePrintPdf}>
                Export PDF
              </button>
            </div>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Historical Data Table</h2>
        {loading ? <p className="loading-hint">Loading assessments...</p> : null}
        {filteredHistory.length === 0 && !loading ? (
          <p className="muted">No assessments match the current filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Status</th>
                  <th>Risk Score</th>
                  <th>Scenario</th>
                  <th>Generated</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.simulationId || item._id}>
                    <td>
                      <strong>{item.response?.situation?.location || item.location}</strong>
                      <div className="muted">{item.simulationId}</div>
                    </td>
                    <td>{item.response?.situation?.status || "UNKNOWN"}</td>
                    <td>{item.response?.situation?.risk_score ?? "n/a"}</td>
                    <td>{item.response?.meta?.scenario_mode || item.scenarioMode || "live"}</td>
                    <td>{formatDate(item.response?.generated_at)}</td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="analytics-grid">
        <article className="panel">
          <h2>Response Time</h2>
          <p className="context-note">
            Average latency is captured at the gateway after the AI engine returns.
          </p>
          <div className="metric-grid">
            <div>
              <span>Average</span>
              <strong>{analytics.latencyAvg != null ? `${analytics.latencyAvg} ms` : "n/a"}</strong>
            </div>
            <div>
              <span>Median</span>
              <strong>
                {analytics.latencyMedian != null ? `${analytics.latencyMedian} ms` : "n/a"}
              </strong>
            </div>
            <div>
              <span>Runs tracked</span>
              <strong>{analytics.totalRuns}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Frequent Disaster Zones</h2>
          <div className="bar-chart">
            {analytics.sortedLocations.length === 0 ? (
              <p className="muted">No location frequency data yet.</p>
            ) : (
              analytics.sortedLocations.map(([label, value]) => (
                <div key={label} className="bar-row">
                  <span>{label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.max(12, (value / analytics.totalRuns) * 100)}%` }}
                    />
                  </div>
                  <strong>{value}</strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <h2>AI Accuracy Metrics</h2>
          <p className="context-note">
            Accuracy proxy is derived from high-quality data runs. Calibrate with real-world
            validations.
          </p>
          <div className="metric-grid">
            <div>
              <span>High-quality runs</span>
              <strong>{analytics.accuracyProxy != null ? `${analytics.accuracyProxy}%` : "n/a"}</strong>
            </div>
            <div>
              <span>Critical alerts</span>
              <strong>{analytics.counts.CRITICAL}</strong>
            </div>
            <div>
              <span>Stable alerts</span>
              <strong>{analytics.counts.STABLE}</strong>
            </div>
          </div>
          <div className="bar-chart">
            {Object.entries(analytics.counts).map(([label, value]) => (
              <div key={label} className="bar-row">
                <span>{label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(value / maxCount) * 100}%` }} />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default HistoryPage;

