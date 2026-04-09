import React, { useEffect, useRef, useState } from "react";

import HazardFeedPanel from "../components/HazardFeedPanel";
import HazardMapPanel from "../components/HazardMapPanel";
import MapPicker from "../components/MapPicker";
import RiskCard from "../components/RiskCard";
import {
  getHealthStatus,
  getSimulationHistory,
  runAssessment,
} from "../services/api";
import { useAssessment } from "../state/AssessmentContext";
import { useHazardFeed } from "../hooks/useHazardFeed";

const DEFAULT_LOCATION = {
  location: "Tirupati, Andhra Pradesh, India",
  latitude: 13.6288,
  longitude: 79.4192,
};

const Dashboard = () => {
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATION);
  const { history, setHistory, setLatestAssessment, latestAssessment } = useAssessment();
  const [result, setResult] = useState(latestAssessment || null);
  const [gatewayHealth, setGatewayHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");
  const hazardMapRef = useRef(null);
  const hazardFeed = useHazardFeed();
  useEffect(() => {
    if (latestAssessment && !result) {
      setResult(latestAssessment);
    }
  }, [latestAssessment, result]);

  useEffect(() => {
    const boot = async () => {
      setBootLoading(true);
      try {
        const [historyRes, healthRes] = await Promise.all([
          getSimulationHistory(12),
          getHealthStatus(),
        ]);
        setHistory(historyRes.data?.data || []);
        setGatewayHealth(healthRes.data?.data || null);
      } catch (bootError) {
        setError(bootError.response?.data?.message || bootError.message);
      } finally {
        setBootLoading(false);
      }
    };
    boot();
  }, []);

  const refreshHistory = async () => {
    const historyRes = await getSimulationHistory(12);
    setHistory(historyRes.data?.data || []);
  };

  const runAssessmentFor = async (locationPayload) => {
    setError("");
    setLoading(true);

    try {
      const response = await runAssessment({
        location: locationPayload.location,
        latitude: locationPayload.latitude,
        longitude: locationPayload.longitude,
        scenario_mode: "live",
        population: 25000,
        search_radius_km: 8,
        blocked_road_ids: [],
      });
      const payload = response.data?.data || null;
      setResult(payload);
      if (payload) {
        setLatestAssessment(payload);
      }
      await refreshHistory();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssessment = async () => {
    await runAssessmentFor(selectedLocation);
  };

  const handleHazardSelect = async (hazard) => {
    if (!Number.isFinite(hazard.latitude) || !Number.isFinite(hazard.longitude)) return;
    hazardMapRef.current?.focusHazard(hazard);
    const nextLocation = {
      location: hazard.location || hazard.title || "Pinned Location",
      latitude: Number(hazard.latitude.toFixed(6)),
      longitude: Number(hazard.longitude.toFixed(6)),
    };
    setSelectedLocation(nextLocation);
    await runAssessmentFor(nextLocation);
  };

  const aiEngineStatus = gatewayHealth?.ai_engine?.status || "unknown";

  return (
    <div className="dashboard-page">
      <section className="hero">
        <p className="hero-eyebrow">Live Command Dashboard</p>
        <h1>Immediate situational awareness</h1>
        <p className="hero-copy">
          Pin a live location, assess the threat, and push instant response recommendations to the
          operations team.
        </p>
      </section>

      <section className="panel status-bar">
        <div>
          <span className="status-label">Gateway</span>
          <strong className="status-ok">ONLINE</strong>
        </div>
        <div>
          <span className="status-label">AI Engine</span>
          <strong className={aiEngineStatus === "ok" ? "status-ok" : "status-alert"}>
            {String(aiEngineStatus).toUpperCase()}
          </strong>
        </div>
        <div>
          <span className="status-label">Runs Loaded</span>
          <strong>{history.length}</strong>
        </div>
        <div>
          <span className="status-label">Input Mode</span>
          <strong>MAP PIN</strong>
        </div>
      </section>

      <section className="control-grid">
        <div className="map-stack">
          <MapPicker onLocationChange={setSelectedLocation} selectedLocation={selectedLocation} />

          <article className="panel">
            <h2>Quick Action Controls</h2>
            <p className="hero-copy">{selectedLocation.location}</p>
            <p className="context-note">
              {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
            </p>
            <button type="button" onClick={handleAssessment} disabled={loading || bootLoading}>
              {loading ? "Running Live Assessment..." : "Assess Pinned Location"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </article>
        </div>

        <div className="report-stack">
          <RiskCard
            title="Active Situation Report"
            situation={result?.situation}
            meta={result?.meta}
          />
          <article className="panel situation-video-panel">
            <div className="panel-header">
              <div>
                <h2>Earth View</h2>
                <p className="hero-copy">Continuous visual context for situational awareness.</p>

              </div>
              <div className="hazard-meta">
                <span className="status-label">Feed</span>
                <strong>Looping</strong>
              </div>
            </div>
            <div className="video-frame">
              <video
                className="situation-video"
                src="/earth.mp4"
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
          </article>
        </div>
      </section>

      <section className="hazard-grid">
        <HazardMapPanel
          ref={hazardMapRef}
          hazards={hazardFeed.hazards}
          error={hazardFeed.error}
          lastUpdated={hazardFeed.lastUpdated}
        />
        <HazardFeedPanel
          hazards={hazardFeed.hazards}
          loading={hazardFeed.loading}
          error={hazardFeed.error}
          onSelect={handleHazardSelect}
        />
      </section>

      {bootLoading ? <p className="loading-hint">Loading project data...</p> : null}
    </div>
  );
};

export default Dashboard;
