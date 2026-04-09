import React, { useState } from "react";
import { NavLink } from "react-router-dom";

const AppHeader = ({ user, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const email = user?.email || "user";
  const initials = email.charAt(0).toUpperCase();

  return (
    <header className="app-header">
      <div className="header-brand">
        <p className="hero-eyebrow">Adaptive Disaster Response Coordinator</p>
        <h1 className="app-title">Operational Command Console</h1>
      </div>

      <nav className="primary-nav">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-link nav-active" : "nav-link")}>
          Live Command
        </NavLink>
        <NavLink to="/simulation" className={({ isActive }) => (isActive ? "nav-link nav-active" : "nav-link")}>
          Agent Reasoning
        </NavLink>
        <NavLink to="/operations" className={({ isActive }) => (isActive ? "nav-link nav-active" : "nav-link")}>
          Operations
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? "nav-link nav-active" : "nav-link")}>
          History & Analytics
        </NavLink>
      </nav>

      <div className="profile-wrap">
        <button
          type="button"
          className="profile-button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Open user menu"
        >
          <span className="profile-avatar">{initials}</span>
        </button>

        {menuOpen ? (
          <div className="profile-menu">
            <p className="profile-email">{email}</p>
            <button type="button" className="profile-logout" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default AppHeader;
