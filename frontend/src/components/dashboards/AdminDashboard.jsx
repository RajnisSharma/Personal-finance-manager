import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";

function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setIsLoading(true);
      setError("");
      const [userResponse, settingResponse] = await Promise.all([
        axios.get("/auth/management/users/"),
        axios.get("/auth/system-settings/"),
      ]);
      setUsers(userResponse.data);
      setSettings(settingResponse.data);
    } catch (err) {
      console.error("Failed to load admin dashboard", err);
      setError("Failed to load administrator dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading administrator workspace...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="alert alert-danger">{error}</div>
          <button type="button" className="btn btn-primary" onClick={loadDashboard}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const normalUsers = users.filter((item) => item.role === "user");
  const managers = users.filter((item) => item.role === "manager");
  const administrators = users.filter((item) => item.role === "administrator");
  const activeUsers = users.filter((item) => item.is_active);
  const totalNetWorth = normalUsers.reduce(
    (total, item) => total + Number(item.financial_snapshot?.net_worth || 0),
    0,
  );
  const totalBudgetAlerts = normalUsers.reduce(
    (total, item) => total + Number(item.financial_snapshot?.budget_alerts || 0),
    0,
  );
  const systemCurrency = settings?.default_base_currency || "USD";
  const highestAttentionUsers = [...normalUsers]
    .sort((left, right) => Number(right.financial_snapshot?.budget_alerts || 0) - Number(left.financial_snapshot?.budget_alerts || 0))
    .slice(0, 5);

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Administrator</p>
          <h1>System control center</h1>
          <p className="meta-copy">
            Manage users, review organization-wide finance activity, and control platform settings.
          </p>
        </div>
        <div className="feature-actions">
          <Link className="btn btn-primary" to="/management/users">
            Manage Users
          </Link>
          <Link className="btn btn-outline-primary" to="/management/settings">
            System Settings
          </Link>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Total users</span>
          <strong className="stat-value">{users.length}</strong>
          <p className="stat-copy">{activeUsers.length} active accounts</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Normal users</span>
          <strong className="stat-value">{normalUsers.length}</strong>
          <p className="stat-copy">End users using finance tools</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Managers</span>
          <strong className="stat-value">{managers.length}</strong>
          <p className="stat-copy">Assigned to monitor user portfolios</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Administrators</span>
          <strong className="stat-value">{administrators.length}</strong>
          <p className="stat-copy">Full system control accounts</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Tracked net worth</span>
          <strong className="stat-value">{formatCurrency(totalNetWorth, systemCurrency)}</strong>
          <p className="stat-copy">Across all normal users in {systemCurrency}</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Budget alerts</span>
          <strong className="stat-value">{totalBudgetAlerts}</strong>
          <p className="stat-copy">Users currently needing attention</p>
        </article>
      </div>

      <div className="dual-grid">
        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Alerts</p>
            <h2>Users needing review</h2>
          </div>
          <div className="feature-list">
            {highestAttentionUsers.length ? (
              highestAttentionUsers.map((item) => (
                <article className="feature-list-item" key={item.id}>
                  <div className="list-head">
                    <div>
                      <strong>{item.username}</strong>
                      <p>{item.email || "No email stored"}</p>
                    </div>
                    <span className="badge-soft warning">
                      {item.financial_snapshot?.budget_alerts || 0} budget alerts
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="meta-copy">
                      Net worth {formatCurrency(Number(item.financial_snapshot?.net_worth || 0), item.financial_snapshot?.currency || systemCurrency)}
                    </span>
                    <Link className="btn btn-sm btn-outline-primary" to="/management/users">
                      Open management
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-panel">
                <strong>No alerts right now</strong>
                <p className="meta-copy">Normal users are currently within their configured budget limits.</p>
              </div>
            )}
          </div>
        </section>

        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Platform</p>
            <h2>Current system settings</h2>
          </div>
          <div className="surface-stack">
            <div className="surface-block">
              <div className="split-row">
                <div>
                  <p className="stat-label">Site name</p>
                  <strong className="metric-inline">{settings?.site_name}</strong>
                </div>
                <span className={`badge-soft ${settings?.maintenance_mode ? "critical" : "success"}`}>
                  {settings?.maintenance_mode ? "Maintenance mode" : "Live"}
                </span>
              </div>
            </div>
            <div className="surface-block">
              <div className="summary-row">
                <span>Self registration</span>
                <strong>{settings?.allow_self_registration ? "Enabled" : "Disabled"}</strong>
              </div>
              <div className="summary-row">
                <span>Default base currency</span>
                <strong>{settings?.default_base_currency}</strong>
              </div>
              <div className="summary-row">
                <span>Support email</span>
                <strong>{settings?.support_email || "Not configured"}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
