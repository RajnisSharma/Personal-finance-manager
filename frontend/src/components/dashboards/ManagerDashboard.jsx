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

export default function ManagerDashboard() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [noteForm, setNoteForm] = useState({ note: "" });
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.get("/auth/management/users/");
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to load manager dashboard", err);
      setError("Failed to load manager dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddNote(userId) {
    if (!noteForm.note.trim()) return;

    try {
      setIsSavingNote(true);
      await axios.post(`/auth/management/users/${userId}/notes/`, {
        note: noteForm.note,
        type: "general",
      });

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? { ...user, manager_notes: [...(user.manager_notes || []), { note: noteForm.note, created_at: new Date().toISOString() }] }
            : user
        )
      );

      setNoteForm({ note: "" });
    } catch (err) {
      console.error("Failed to add note", err);
      setError("Failed to add note. Please try again.");
    } finally {
      setIsSavingNote(false);
    }
  }

  function getStatusBadge(user) {
    const alerts = Number(user.financial_snapshot?.budget_alerts || 0);
    const expenses = Number(user.financial_snapshot?.expense_total || 0);
    const income = Number(user.financial_snapshot?.income_total || 0);

    if (alerts > 0) return { class: "warning", text: "Needs Review" };
    if (expenses > income * 0.9) return { class: "caution", text: "High Spend" };
    return { class: "success", text: "Healthy" };
  }

  if (isLoading) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading manager workspace...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="alert alert-danger">{error}</div>
          <button type="button" className="btn btn-primary" onClick={loadUsers}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const totalNetWorth = users.reduce((total, item) => total + Number(item.financial_snapshot?.net_worth || 0), 0);
  const totalExpense = users.reduce((total, item) => total + Number(item.financial_snapshot?.expense_total || 0), 0);
  const totalIncome = users.reduce((total, item) => total + Number(item.financial_snapshot?.income_total || 0), 0);
  const usersNeedingAttention = users.filter((item) => Number(item.financial_snapshot?.budget_alerts || 0) > 0);
  const highSpenders = users.filter((item) => {
    const expenses = Number(item.financial_snapshot?.expense_total || 0);
    const income = Number(item.financial_snapshot?.income_total || 0);
    return expenses > income * 0.9 && Number(item.financial_snapshot?.budget_alerts || 0) === 0;
  });
  const reportingCurrency = users[0]?.financial_snapshot?.currency || "USD";

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Account Manager</p>
          <h1>Client Finance Oversight</h1>
          <p className="meta-copy">
            Monitor assigned clients, review financial health, add advisory notes, and generate reports for planning conversations.
          </p>
        </div>
        <div className="feature-actions">
          <Link className="btn btn-primary" to="/reports">
            Client Reports
          </Link>
          <Link className="btn btn-outline-primary" to="/dashboard">
            Refresh Dashboard
          </Link>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Assigned Clients</span>
          <strong className="stat-value">{users.length}</strong>
          <p className="stat-copy">Users under your management</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Total Net Worth</span>
          <strong className="stat-value">{formatCurrency(totalNetWorth, reportingCurrency)}</strong>
          <p className="stat-copy">Combined client assets</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Combined Income</span>
          <strong className="stat-value">{formatCurrency(totalIncome, reportingCurrency)}</strong>
          <p className="stat-copy">Total client earnings</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Combined Expenses</span>
          <strong className="stat-value">{formatCurrency(totalExpense, reportingCurrency)}</strong>
          <p className="stat-copy">Total client spending</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Needs Attention</span>
          <strong className="stat-value" style={{ color: usersNeedingAttention.length > 0 ? "#b91c1c" : "inherit" }}>
            {usersNeedingAttention.length}
          </strong>
          <p className="stat-copy">Clients with budget alerts</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">High Spending</span>
          <strong className="stat-value">{highSpenders.length}</strong>
          <p className="stat-copy">Clients spending &gt;90% of income</p>
        </article>
      </div>

      <div className="dual-grid">
        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Priority Clients</p>
            <h2>Clients Requiring Attention</h2>
          </div>
          <div className="feature-list">
            {usersNeedingAttention.length > 0 ? (
              usersNeedingAttention.map((item) => {
                const status = getStatusBadge(item);
                return (
                  <article className="feature-list-item" key={item.id}>
                    <div className="list-head">
                      <div>
                        <strong>{item.username}</strong>
                        <p>{item.email || "No email stored"}</p>
                      </div>
                      <span className={`badge-soft ${status.class}`}>{status.text}</span>
                    </div>
                    <div className="summary-row">
                      <span className="meta-copy">
                        Net worth {formatCurrency(Number(item.financial_snapshot?.net_worth || 0), item.financial_snapshot?.currency || reportingCurrency)}
                      </span>
                      <span className="meta-copy" style={{ color: "#b91c1c" }}>
                        {item.financial_snapshot?.budget_alerts || 0} budget alerts
                      </span>
                    </div>
                    <div className="inline-actions">
                      <Link className="btn btn-sm btn-outline-primary" to={`/reports?user=${item.id}`}>
                        View Report
                      </Link>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedUser(item)}>
                        Add Note
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-panel">
                <strong>No urgent alerts</strong>
                <p className="meta-copy">All your clients are within budget limits.</p>
              </div>
            )}
          </div>
        </section>

        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">All Clients</p>
            <h2>Client Overview</h2>
          </div>
          <div className="feature-list">
            {users.length > 0 ? (
              users.map((item) => {
                const status = getStatusBadge(item);
                return (
                  <article className="feature-list-item" key={item.id}>
                    <div className="list-head">
                      <div>
                        <strong>{item.username}</strong>
                        <p>{item.email || "No email stored"}</p>
                      </div>
                      <span className={`badge-soft ${status.class}`}>{status.text}</span>
                    </div>
                    <div className="summary-row">
                      <span className="meta-copy">
                        Net worth {formatCurrency(Number(item.financial_snapshot?.net_worth || 0), item.financial_snapshot?.currency || reportingCurrency)}
                      </span>
                      <span className="meta-copy">
                        Income {formatCurrency(Number(item.financial_snapshot?.income_total || 0), item.financial_snapshot?.currency || reportingCurrency)}
                      </span>
                    </div>
                    {selectedUser?.id === item.id && (
                      <div className="surface-block" style={{ marginTop: "0.75rem" }}>
                        <label className="form-group">
                          <span className="form-label">Add Advisory Note</span>
                          <textarea
                            className="form-control"
                            rows="2"
                            value={noteForm.note}
                            onChange={(e) => setNoteForm({ note: e.target.value })}
                            placeholder="Enter note or advice for this client..."
                          />
                        </label>
                        <div className="inline-actions" style={{ marginTop: "0.5rem" }}>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedUser(null)}>
                            Cancel
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleAddNote(item.id)}
                            disabled={isSavingNote || !noteForm.note.trim()}
                          >
                            {isSavingNote ? "Saving..." : "Save Note"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="empty-panel">
                <strong>No assigned clients yet</strong>
                <p className="meta-copy">Ask an administrator to assign clients to your account.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="feature-card">
        <div className="list-title">
          <p className="stat-label">Quick Actions</p>
          <h2>Manager Tools</h2>
        </div>
        <div className="feature-list">
          <article className="feature-list-item">
            <div className="list-head">
              <div>
                <strong>Generate Client Reports</strong>
                <p>Create detailed financial reports for your assigned clients</p>
              </div>
              <Link className="btn btn-sm btn-outline-primary" to="/reports">
                Go to Reports
              </Link>
            </div>
          </article>
          <article className="feature-list-item">
            <div className="list-head">
              <div>
                <strong>Review Client Reports</strong>
                <p>Generate detailed financial reports for your assigned clients</p>
              </div>
              <Link className="btn btn-sm btn-outline-primary" to="/reports">
                View Reports
              </Link>
            </div>
          </article>
          <article className="feature-list-item">
            <div className="list-head">
              <div>
                <strong>Update Your Profile</strong>
                <p>Manage your account settings and preferences</p>
              </div>
              <Link className="btn btn-sm btn-outline-primary" to="/settings">
                Settings
              </Link>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}
