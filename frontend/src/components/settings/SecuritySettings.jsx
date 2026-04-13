import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";

const defaultProfile = {
  base_currency: "USD",
  email_notifications: true,
  push_notifications: false,
  in_app_notifications: true,
  low_balance_threshold: "100.00",
  two_factor_enabled: false,
};

export default function SecuritySettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(defaultProfile);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableBackupCode, setDisableBackupCode] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");
      const [meResponse, profileResponse] = await Promise.all([axios.get("/auth/me/"), axios.get("/auth/profile/")]);
      setUser(meResponse.data);
      setProfile(profileResponse.data);
    } catch (err) {
      console.error("Failed to load security settings", err);
      setError("Failed to load account settings.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleProfileChange(event) {
    const { name, value, type, checked } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      setIsSavingProfile(true);
      setError("");
      await axios.patch("/auth/profile/", {
        ...profile,
        base_currency: profile.base_currency.toUpperCase(),
        low_balance_threshold: Number(profile.low_balance_threshold),
      });
      setSuccess("Settings updated.");
    } catch (err) {
      console.error("Failed to save profile", err);
      setError("Failed to update settings.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function startSetup() {
    try {
      setError("");
      const response = await axios.post("/auth/2fa/setup/");
      setSetupData(response.data);
      setSuccess("Two-factor setup started. Add the secret to your authenticator app, then verify with a code.");
    } catch (err) {
      setError("Failed to start two-factor setup.");
    }
  }

  async function verifySetup(event) {
    event.preventDefault();
    try {
      await axios.post("/auth/2fa/verify/", { code: verificationCode });
      setVerificationCode("");
      setSetupData(null);
      setSuccess("Two-factor authentication enabled.");
      await loadData();
    } catch (err) {
      setError("Invalid verification code.");
    }
  }

  async function disableTwoFactor(event) {
    event.preventDefault();
    try {
      await axios.post("/auth/2fa/disable/", {
        code: disableCode,
        backup_code: disableBackupCode,
      });
      setDisableCode("");
      setDisableBackupCode("");
      setSuccess("Two-factor authentication disabled.");
      await loadData();
    } catch (err) {
      setError("Failed to disable two-factor authentication.");
    }
  }

  async function downloadExport() {
    try {
      const response = await axios.get("/auth/export/");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pfm-export.json";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export account data.");
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    try {
      await axios.post("/auth/delete/", {
        password: deletePassword,
        confirmation: deleteConfirmation,
      });
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("username");
      navigate("/register", { replace: true });
    } catch (err) {
      console.error("Failed to delete account", err);
      setError("Failed to delete account. Double-check your password and confirmation text.");
    }
  }

  if (isLoading) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading settings...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Settings</p>
          <h1>Security, export, and notification controls</h1>
          <p className="meta-copy">
            Manage base currency, 2FA, notification preferences, and your data lifecycle settings.
          </p>
        </div>
        <div className="feature-actions">
          <button type="button" className="btn btn-outline-primary" onClick={downloadExport}>
            Export JSON
          </button>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">User</span>
          <strong className="stat-value">{user?.username}</strong>
          <p className="stat-copy">
            {user?.email || "No email stored"}
            {user?.role_display ? ` • ${user.role_display}` : ""}
          </p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Base currency</span>
          <strong className="stat-value">{profile.base_currency}</strong>
          <p className="stat-copy">Used for dashboard totals and portfolio conversion</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Two-factor auth</span>
          <strong className="stat-value">{profile.two_factor_enabled ? "On" : "Off"}</strong>
          <p className="stat-copy">OTP or backup code enforced at login when enabled</p>
        </article>
      </div>

      <div className="dual-grid">
        <form className="feature-card" onSubmit={saveProfile}>
          <div className="list-title">
            <p className="stat-label">Profile</p>
            <h2>Preferences</h2>
          </div>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Base currency</span>
              <select className="form-select" name="base_currency" value={profile.base_currency} onChange={handleProfileChange}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">Low balance threshold</span>
              <input
                className="form-control"
                type="number"
                step="0.01"
                name="low_balance_threshold"
                value={profile.low_balance_threshold}
                onChange={handleProfileChange}
              />
            </label>

            <label className="form-group toggle-row full-width">
              <input
                type="checkbox"
                name="email_notifications"
                checked={profile.email_notifications}
                onChange={handleProfileChange}
              />
              <span>Email notifications</span>
            </label>

            <label className="form-group toggle-row full-width">
              <input
                type="checkbox"
                name="push_notifications"
                checked={profile.push_notifications}
                onChange={handleProfileChange}
              />
              <span>Push notifications</span>
            </label>

            <label className="form-group toggle-row full-width">
              <input
                type="checkbox"
                name="in_app_notifications"
                checked={profile.in_app_notifications}
                onChange={handleProfileChange}
              />
              <span>In-app notifications</span>
            </label>
          </div>

          <div className="form-actions">
            <p className="meta-copy">These preferences apply to generated alerts, reminders, and sync notices.</p>
            <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save preferences"}
            </button>
          </div>
        </form>

        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Security</p>
            <h2>Two-factor authentication</h2>
          </div>

          <div className="surface-stack">
            <div className="surface-block">
              <div className="split-row">
                <div>
                  <p className="stat-label">Status</p>
                  <strong className="metric-inline">{profile.two_factor_enabled ? "Enabled" : "Disabled"}</strong>
                </div>
                {!profile.two_factor_enabled ? (
                  <button type="button" className="btn btn-primary" onClick={startSetup}>
                    Start setup
                  </button>
                ) : null}
              </div>
            </div>

            {setupData ? (
              <form className="surface-block" onSubmit={verifySetup}>
                <div className="surface-stack">
                  <p className="meta-copy">Secret</p>
                  <pre className="code-card">{setupData.secret}</pre>
                  <p className="meta-copy">Authenticator URI</p>
                  <pre className="code-card">{setupData.otpauth_uri}</pre>
                  <p className="meta-copy">Backup codes</p>
                  <pre className="code-card">{setupData.backup_codes.join("\n")}</pre>
                  <label className="form-group">
                    <span className="form-label">Verification code</span>
                    <input
                      className="form-control"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      placeholder="6-digit OTP"
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <p className="meta-copy">Store the backup codes somewhere safe before you verify.</p>
                    <button type="submit" className="btn btn-primary">
                      Verify and enable
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {profile.two_factor_enabled ? (
              <form className="surface-block" onSubmit={disableTwoFactor}>
                <div className="surface-stack">
                  <p className="meta-copy">Provide either a current OTP code or one unused backup code.</p>
                  <label className="form-group">
                    <span className="form-label">OTP code</span>
                    <input className="form-control" value={disableCode} onChange={(event) => setDisableCode(event.target.value)} />
                  </label>
                  <label className="form-group">
                    <span className="form-label">Backup code</span>
                    <input className="form-control" value={disableBackupCode} onChange={(event) => setDisableBackupCode(event.target.value)} />
                  </label>
                  <div className="form-actions">
                    <span className="meta-copy">Disabling 2FA removes OTP enforcement for future logins.</span>
                    <button type="submit" className="btn btn-outline-secondary">
                      Disable 2FA
                    </button>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </div>

      <form className="feature-card danger-zone" onSubmit={deleteAccount}>
        <div className="list-title">
          <p className="stat-label">Danger zone</p>
          <h2>Delete account</h2>
          <p className="meta-copy">
            This removes your user and finance data from the application. Type DELETE to confirm.
          </p>
        </div>

        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Password</span>
            <input
              className="form-control"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              required
            />
          </label>
          <label className="form-group">
            <span className="form-label">Confirmation</span>
            <input
              className="form-control"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="DELETE"
              required
            />
          </label>
        </div>

        <div className="form-actions">
          <p className="meta-copy">Audit logs remain anonymized because they are detached with a null user reference.</p>
          <button type="submit" className="btn btn-outline-secondary">
            Delete my account
          </button>
        </div>
      </form>
    </section>
  );
}
