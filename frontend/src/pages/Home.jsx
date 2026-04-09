import React from "react";
import { Link } from "react-router-dom";

const Home = () => (
  <div className="landing-page">
    <header className="public-header">
      <div>
        <p className="hero-eyebrow">Adaptive Disaster Response Coordinator</p>
        <h1 className="public-title">Operational Intelligence For Rapid Response</h1>
      </div>
      <div className="public-cta">
        <Link className="ghost-button" to="/login">
          Sign in
        </Link>
        <Link className="solid-button" to="/login">
          Enter Command Console
        </Link>
      </div>
    </header>

    <section className="landing-hero">
      <div>
        <h2>Coordinate live response with a multi-agent system built for real disasters.</h2>
        <p>
          The Adaptive Disaster Response Coordinator orchestrates geocoding, hazard analysis, resource
          allocation, and evacuation routing in minutes. Designed for district operations rooms and
          cross-agency visibility.
        </p>
        <div className="hero-actions">
          <Link className="solid-button" to="/login">
            Access Operational Command
          </Link>
          <Link className="ghost-button" to="/login">
            Request Credentials
          </Link>
        </div>
      </div>
      <div className="hero-card">
        <h3>Live System Highlights</h3>
        <ul>
          <li>Autonomous handoffs across Situation, Resource, and Evacuation agents.</li>
          <li>Real-time geocoding, routing, and facility discovery.</li>
          <li>Climate resilience modeling with public alert overlays.</li>
          <li>Incident-ready recommendations for field coordinators.</li>
        </ul>
      </div>
    </section>

    <section className="capability-section">
      <div className="section-title">
        <h2>System Capabilities</h2>
        <p>High-level modules designed for multi-agency coordination.</p>
      </div>
      <div className="capability-grid">
        <article className="capability-card">
          <h3>Autonomous Handoffs</h3>
          <p>
            The AI agents coordinate situational assessment, resource deployment, and routing without
            waiting for manual relays.
          </p>
        </article>
        <article className="capability-card">
          <h3>Real-time Geocoding</h3>
          <p>
            Pinpoint villages and wards instantly with verified coordinates, facility discovery, and
            geospatial context.
          </p>
        </article>
        <article className="capability-card">
          <h3>Climate Resilience</h3>
          <p>
            Forecast flood pressure, storm severity, and evacuation bottlenecks with live signals and
            verified alerts.
          </p>
        </article>
      </div>
    </section>

    <section className="landing-footer">
      <div>
        <h2>Operational Command Console</h2>
        <p>
          Secure access for district officers, emergency managers, and rapid response teams.
        </p>
      </div>
      <Link className="solid-button" to="/login">
        Proceed to Login
      </Link>
    </section>
  </div>
);

export default Home;

