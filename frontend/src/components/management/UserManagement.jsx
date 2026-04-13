import React, { useEffect, useMemo, useState } from "react";

import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";
import { canManageUsers, getStoredRole, isAdminRole, ROLE_MANAGER, ROLE_USER } from "../../utils/session";
import { formatCurrency } from "../../utils/formatters";

const defaultForm = {
  username: "",
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: ROLE_USER,
  is_active: true,
  base_currency: "USD",
  manager_ids: [],
  managed_user_ids: [],
};

function mapUserToEditableForm(user) {
  return {
    username: user.username || "",
    email: user.email || "",
    password: "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    role: user.role || ROLE_USER,
    is_active: Boolean(user.is_active),
    base_currency: user.profile?.base_currency || "USD",
    manager_ids: user.manager_ids || [],
    managed_user_ids: user.managed_user_ids || [],
  };
}

export default function UserManagement() {
  const role = getStoredRole();
  const isAdmin = isAdminRole(role);
  const [users, setUsers] = useState([]);
  const [createForm, setCreateForm] = useState(defaultForm);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState(defaultForm);
  const [reportData, setReportData] = useState(null);
  const [reportUser, setReportUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const managers = useMemo(() => users.filter((item) => item.role === ROLE_MANAGER), [users]);
  const normalUsers = useMemo(() => users.filter((item) => item.role === ROLE_USER), [users]);

  useEffect(() => {
    if (!canManageUsers(role)) {
      setError("You do not have permission to access user management.");
      setIsLoading(false);
      return;
    }
    loadUsers();
  }, [role]);

  async function loadUsers() {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.get("/auth/management/users/");
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to load users", err);
      setError("Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleInputChange(setter, event) {
    const { name, value, type, checked, options, multiple } = event.target;
    setter((current) => {
      if (type === "checkbox") {
        return { ...current, [name]: checked };
      }
      if (multiple) {
        return {
          ...current,
          [name]: Array.from(options).filter((item) => item.selected).map((item) => Number(item.value)),
        };
      }
      return { ...current, [name]: value };
    });
  }

  function buildPayload(form) {
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      is_active: Boolean(form.is_active),
      base_currency: form.base_currency.toUpperCase(),
      manager_ids: form.role === ROLE_USER ? form.manager_ids : [],
      managed_user_ids: form.role === ROLE_MANAGER ? form.managed_user_ids : [],
    };

    if (form.password) {
      payload.password = form.password;
    }

    return payload;
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError("");
      const response = await axios.post("/auth/management/users/", buildPayload(createForm));
      setUsers((current) => [...current, response.data].sort((left, right) => left.username.localeCompare(right.username)));
      setCreateForm(defaultForm);
      setSuccess(`Created ${response.data.username}.`);
    } catch (err) {
      console.error("Failed to create user", err);
      setError("Failed to create user. Check the form values and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(user) {
    setEditUserId(user.id);
    setEditForm(mapUserToEditableForm(user));
    setSuccess("");
    setError("");
  }

  async function handleSaveUser(userId) {
    try {
      setIsSaving(true);
      setError("");
      const response = await axios.patch(`/auth/management/users/${userId}/`, buildPayload(editForm));
      setUsers((current) => current.map((item) => (item.id === userId ? response.data : item)));
      setEditUserId(null);
      setSuccess(`Updated ${response.data.username}.`);
    } catch (err) {
      console.error("Failed to update user", err);
      setError("Failed to update user.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(userId, username) {
    const confirmed = window.confirm(`Delete ${username}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      await axios.delete(`/auth/management/users/${userId}/`);
      setUsers((current) => current.filter((item) => item.id !== userId));
      setSuccess(`Deleted ${username}.`);
      if (reportUser?.id === userId) {
        setReportUser(null);
        setReportData(null);
      }
    } catch (err) {
      console.error("Failed to delete user", err);
      setError("Failed to delete user.");
    }
  }

  async function handleLoadReport(user) {
    try {
      setIsLoadingReport(true);
      setError("");
      const response = await axios.get(`/auth/management/users/${user.id}/report/`);
      setReportUser(user);
      setReportData(response.data);
    } catch (err) {
      console.error("Failed to load report", err);
      setError("Failed to load report.");
    } finally {
      setIsLoadingReport(false);
    }
  }

  function handleDownloadReport() {
    if (!reportData || !reportUser) {
      return;
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportUser.username}-financial-report.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function renderAssignmentField(form, setter, prefix) {
    if (form.role === ROLE_USER) {
      return (
        <label className="form-group full-width">
          <span className="form-label">Assigned managers</span>
          <select
            className="form-select"
            multiple
            name="manager_ids"
            value={form.manager_ids.map(String)}
            onChange={(event) => handleInputChange(setter, event)}
          >
            {managers.map((item) => (
              <option key={`${prefix}-manager-${item.id}`} value={item.id}>
                {item.username}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (form.role === ROLE_MANAGER) {
      return (
        <label className="form-group full-width">
          <span className="form-label">Managed users</span>
          <select
            className="form-select"
            multiple
            name="managed_user_ids"
            value={form.managed_user_ids.map(String)}
            onChange={(event) => handleInputChange(setter, event)}
          >
            {normalUsers.map((item) => (
              <option key={`${prefix}-user-${item.id}`} value={item.id}>
                {item.username}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return null;
  }

  if (isLoading) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading user management...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Management</p>
          <h1>{isAdmin ? "User administration" : "Managed users"}</h1>
          <p className="meta-copy">
            {isAdmin
              ? "Create, edit, assign, and remove users across the platform."
              : "Review your assigned users and generate finance reports for planning conversations."}
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      {isAdmin ? (
        <form className="feature-card" onSubmit={handleCreateUser}>
          <div className="list-title">
            <p className="stat-label">Create user</p>
            <h2>Add a new platform account</h2>
          </div>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Username</span>
              <input className="form-control" name="username" value={createForm.username} onChange={(event) => handleInputChange(setCreateForm, event)} required />
            </label>
            <label className="form-group">
              <span className="form-label">Email</span>
              <input className="form-control" type="email" name="email" value={createForm.email} onChange={(event) => handleInputChange(setCreateForm, event)} required />
            </label>
            <label className="form-group">
              <span className="form-label">Password</span>
              <input className="form-control" type="password" name="password" value={createForm.password} onChange={(event) => handleInputChange(setCreateForm, event)} required />
            </label>
            <label className="form-group">
              <span className="form-label">Role</span>
              <select className="form-select" name="role" value={createForm.role} onChange={(event) => handleInputChange(setCreateForm, event)}>
                <option value={ROLE_USER}>Normal User</option>
                <option value={ROLE_MANAGER}>Account / Finance Manager</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">First name</span>
              <input className="form-control" name="first_name" value={createForm.first_name} onChange={(event) => handleInputChange(setCreateForm, event)} />
            </label>
            <label className="form-group">
              <span className="form-label">Last name</span>
              <input className="form-control" name="last_name" value={createForm.last_name} onChange={(event) => handleInputChange(setCreateForm, event)} />
            </label>
            <label className="form-group">
              <span className="form-label">Base currency</span>
              <select className="form-select" name="base_currency" value={createForm.base_currency} onChange={(event) => handleInputChange(setCreateForm, event)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <label className="form-group toggle-row">
              <input type="checkbox" name="is_active" checked={createForm.is_active} onChange={(event) => handleInputChange(setCreateForm, event)} />
              <span>Account active</span>
            </label>
            {renderAssignmentField(createForm, setCreateForm, "create")}
          </div>

          <div className="form-actions">
            <p className="meta-copy">Normal users can self-manage budgets. Managers can only be created by administrators.</p>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create user"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="dual-grid">
        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Users</p>
            <h2>{isAdmin ? "All platform accounts" : "Assigned user accounts"}</h2>
          </div>

          <div className="feature-list">
            {users.length ? (
              users.map((user) => {
                const isEditing = editUserId === user.id;
                return (
                  <article className="feature-list-item" key={user.id}>
                    <div className="list-head">
                      <div>
                        <strong>{user.username}</strong>
                        <p>{user.email || "No email stored"}</p>
                      </div>
                      <span className={`badge-soft ${user.is_active ? "success" : "critical"}`}>{user.role_display}</span>
                    </div>

                    <div className="summary-row">
                      <span className="meta-copy">
                        Net worth {formatCurrency(user.financial_snapshot?.net_worth, user.financial_snapshot?.currency || "USD")}
                      </span>
                      <span className="meta-copy">Budget alerts {user.financial_snapshot?.budget_alerts || 0}</span>
                    </div>

                    <div className="summary-row">
                      <span className="meta-copy">
                        {user.role === ROLE_USER
                          ? `Managers: ${user.manager_names?.join(", ") || "None"}`
                          : `Managed users: ${user.assigned_user_count || 0}`}
                      </span>
                      <div className="inline-actions">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleLoadReport(user)} disabled={isLoadingReport}>
                          {isLoadingReport && reportUser?.id === user.id ? "Loading..." : "View report"}
                        </button>
                        {isAdmin ? (
                          <>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => startEditing(user)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUser(user.id, user.username)}>
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {isAdmin && isEditing ? (
                      <div className="surface-block">
                        <div className="form-grid">
                          <label className="form-group">
                            <span className="form-label">Username</span>
                            <input className="form-control" name="username" value={editForm.username} onChange={(event) => handleInputChange(setEditForm, event)} />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Email</span>
                            <input className="form-control" type="email" name="email" value={editForm.email} onChange={(event) => handleInputChange(setEditForm, event)} />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Password</span>
                            <input className="form-control" type="password" name="password" value={editForm.password} onChange={(event) => handleInputChange(setEditForm, event)} placeholder="Leave blank to keep current password" />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Role</span>
                            <select className="form-select" name="role" value={editForm.role} onChange={(event) => handleInputChange(setEditForm, event)}>
                              <option value={ROLE_USER}>Normal User</option>
                              <option value={ROLE_MANAGER}>Account / Finance Manager</option>
                              <option value="administrator">Administrator</option>
                            </select>
                          </label>
                          <label className="form-group">
                            <span className="form-label">First name</span>
                            <input className="form-control" name="first_name" value={editForm.first_name} onChange={(event) => handleInputChange(setEditForm, event)} />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Last name</span>
                            <input className="form-control" name="last_name" value={editForm.last_name} onChange={(event) => handleInputChange(setEditForm, event)} />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Base currency</span>
                            <select className="form-select" name="base_currency" value={editForm.base_currency} onChange={(event) => handleInputChange(setEditForm, event)}>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="INR">INR</option>
                              <option value="GBP">GBP</option>
                            </select>
                          </label>
                          <label className="form-group toggle-row">
                            <input type="checkbox" name="is_active" checked={editForm.is_active} onChange={(event) => handleInputChange(setEditForm, event)} />
                            <span>Account active</span>
                          </label>
                          {renderAssignmentField(editForm, setEditForm, `edit-${user.id}`)}
                        </div>

                        <div className="form-actions">
                          <button type="button" className="btn btn-outline-secondary" onClick={() => setEditUserId(null)}>
                            Cancel
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => handleSaveUser(user.id)} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save changes"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="empty-panel">
                <strong>No users available</strong>
                <p className="meta-copy">
                  {isAdmin ? "Create the first user from the form above." : "Ask an administrator to assign users to you."}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Report</p>
            <h2>{reportUser ? `${reportUser.username} financial report` : "Select a user report"}</h2>
          </div>

          {reportData ? (
            <div className="surface-stack">
              <div className="stats-grid">
                <article className="stat-card">
                  <span className="stat-label">Net worth</span>
                  <strong className="stat-value">{formatCurrency(reportData.summary?.net_worth, reportData.summary?.base_currency || "USD")}</strong>
                  <p className="stat-copy">Current aggregate balance</p>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Income</span>
                  <strong className="stat-value">{formatCurrency(reportData.summary?.income_total, reportData.summary?.base_currency || "USD")}</strong>
                  <p className="stat-copy">Current reporting period</p>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Expense</span>
                  <strong className="stat-value">{formatCurrency(reportData.summary?.expense_total, reportData.summary?.base_currency || "USD")}</strong>
                  <p className="stat-copy">Current reporting period</p>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Goals</span>
                  <strong className="stat-value">{reportData.summary?.goals?.length || 0}</strong>
                  <p className="stat-copy">Tracked savings or debt goals</p>
                </article>
              </div>
              <div className="surface-block">
                <div className="summary-row">
                  <span>Accounts</span>
                  <strong>{reportData.summary?.accounts?.length || 0}</strong>
                </div>
                <div className="summary-row">
                  <span>Transactions exported</span>
                  <strong>{reportData.transactions?.length || 0}</strong>
                </div>
                <div className="summary-row">
                  <span>Unread notifications</span>
                  <strong>{reportData.summary?.unread_notifications || 0}</strong>
                </div>
              </div>
              <div className="form-actions">
                <p className="meta-copy">Use the JSON export for deeper analysis, audit review, or advisory preparation.</p>
                <button type="button" className="btn btn-outline-primary" onClick={handleDownloadReport}>
                  Download JSON report
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-panel">
              <strong>No report loaded</strong>
              <p className="meta-copy">Choose “View report” on a user row to inspect their finance summary and export the report.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
