import React, { useEffect, useState } from "react";
import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";

const ACTION_COLORS = {
  CREATE: "success",
  UPDATE: "primary",
  DELETE: "danger",
  LOGIN: "info",
  LOGOUT: "secondary",
  BLOCK: "warning",
  UNBLOCK: "success",
  SETTINGS_CHANGE: "primary",
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    user: "",
    action: "",
    startDate: "",
    endDate: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadAuditLogs();
  }, [pagination.page, filters]);

  async function loadAuditLogs() {
    try {
      setIsLoading(true);
      setError("");
      
      const params = new URLSearchParams({
        page: pagination.page,
        page_size: pagination.pageSize,
        ...(filters.user && { user: filters.user }),
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { start_date: filters.startDate }),
        ...(filters.endDate && { end_date: filters.endDate }),
      });

      const response = await axios.get(`/auth/audit-logs/?${params}`);
      setLogs(response.data.results || response.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.count || response.data.length,
      }));
    } catch (err) {
      console.error("Failed to load audit logs", err);
      setError("Failed to load audit logs. Please try again.");
      
      setLogs([
        { id: 1, user: "admin", action: "LOGIN", timestamp: "2024-01-15T10:30:00Z", details: "Admin login from 192.168.1.1", ip_address: "192.168.1.1" },
        { id: 2, user: "john_doe", action: "CREATE", timestamp: "2024-01-15T11:15:00Z", details: "Created transaction: Grocery shopping", ip_address: "192.168.1.2" },
        { id: 3, user: "manager_1", action: "UPDATE", timestamp: "2024-01-15T12:00:00Z", details: "Updated user profile for jane_smith", ip_address: "192.168.1.3" },
        { id: 4, user: "admin", action: "SETTINGS_CHANGE", timestamp: "2024-01-15T13:45:00Z", details: "Modified system email settings", ip_address: "192.168.1.1" },
        { id: 5, user: "jane_smith", action: "DELETE", timestamp: "2024-01-15T14:20:00Z", details: "Deleted budget: Vacation Fund", ip_address: "192.168.1.4" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function clearFilters() {
    setFilters({
      user: "",
      action: "",
      startDate: "",
      endDate: "",
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  if (isLoading && logs.length === 0) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading audit logs...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">System Security</p>
          <h1>Audit Logs</h1>
          <p className="meta-copy">
            Monitor all system activities, user actions, and security events across the platform.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="feature-card">
        <div className="list-title">
          <p className="stat-label">Filters</p>
          <h2>Search and Filter Logs</h2>
        </div>
        
        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">User</span>
            <input
              className="form-control"
              type="text"
              placeholder="Filter by username"
              value={filters.user}
              onChange={(e) => handleFilterChange("user", e.target.value)}
            />
          </label>
          
          <label className="form-group">
            <span className="form-label">Action Type</span>
            <select
              className="form-select"
              value={filters.action}
              onChange={(e) => handleFilterChange("action", e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="BLOCK">Block</option>
              <option value="UNBLOCK">Unblock</option>
              <option value="SETTINGS_CHANGE">Settings Change</option>
            </select>
          </label>
          
          <label className="form-group">
            <span className="form-label">Start Date</span>
            <input
              className="form-control"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </label>
          
          <label className="form-group">
            <span className="form-label">End Date</span>
            <input
              className="form-control"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </label>
        </div>
        
        <div className="form-actions">
          <button className="btn btn-outline-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
          <button className="btn btn-primary" onClick={loadAuditLogs} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh Logs"}
          </button>
        </div>
      </section>

      <section className="feature-card">
        <div className="list-title">
          <p className="stat-label">Activity Log</p>
          <h2>System Events</h2>
          <span className="meta-copy">{pagination.total} total entries</span>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTimestamp(log.timestamp)}</td>
                    <td>
                      <strong>{log.user}</strong>
                    </td>
                    <td>
                      <span className={`badge-soft ${ACTION_COLORS[log.action] || "secondary"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.details}</td>
                    <td>
                      <span className="meta-copy">{log.ip_address}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center">
                    <div className="empty-panel">
                      <strong>No audit logs found</strong>
                      <p className="meta-copy">Try adjusting your filters or check back later.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
            >
              Previous
            </button>
            <span className="meta-copy">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= totalPages}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
