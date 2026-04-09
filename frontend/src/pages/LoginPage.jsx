import React, { useState } from "react";

const LoginPage = ({ onLogin, onSignup, loading, onAuthSuccess }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      if (mode === "login") {
        await onLogin({ email, password });
        if (onAuthSuccess) onAuthSuccess();
        return;
      }

      const result = await onSignup({ email, password });
      if (result?.access_token) {
        setNotice("Account created and signed in successfully.");
        if (onAuthSuccess) onAuthSuccess();
      } else {
        setNotice("Account created. Check your email to confirm your signup before logging in.");
      }
    } catch (authError) {
      setError(authError.response?.data?.error_description || authError.message);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-panel">
        <p className="hero-eyebrow">Secure Access</p>
        <h1>{mode === "login" ? "Login to continue" : "Create an account"}</h1>
        <p className="hero-copy">
          Only authenticated responders and officers can access the disaster response dashboard.
        </p>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === "login" ? "auth-switch-active" : "auth-switch-muted"}
            onClick={() => {
              setMode("login");
              setError("");
              setNotice("");
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "auth-switch-active" : "auth-switch-muted"}
            onClick={() => {
              setMode("signup");
              setError("");
              setNotice("");
            }}
          >
            Sign up
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="officer@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {mode === "signup" ? (
            <label>
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                required
              />
            </label>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="context-note">{notice}</p> : null}
        <p className="context-note">Accounts are managed with Supabase Auth.</p>
      </section>
    </div>
  );
};

export default LoginPage;
