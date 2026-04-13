import React, { useEffect, useMemo, useState } from "react";

import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";

const filterOptions = [
  { label: "All activity", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Read", value: "read" },
];

const formatTimestamp = (value) =>
  value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Just now";

export default function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.get("/notifications/");
      setNotifications(response.data.results || response.data);
    } catch (err) {
      console.error("Failed to load notifications", err);
      setError("Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }

  async function markRead(id) {
    try {
      await axios.post(`/notifications/${id}/mark_read/`);
      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
        )
      );
    } catch (err) {
      setError("Failed to mark notification as read.");
    }
  }

  async function markAllRead() {
    try {
      await axios.post("/notifications/mark_all_read/");
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }))
      );
    } catch (err) {
      setError("Failed to mark all notifications as read.");
    }
  }

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((item) => !item.is_read);
    }
    if (activeFilter === "read") {
      return notifications.filter((item) => item.is_read);
    }
    return notifications;
  }, [activeFilter, notifications]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const warningCount = notifications.filter((item) => ["warning", "critical"].includes(item.severity)).length;
  const paymentCount = notifications.filter((item) => item.notification_type === "payment").length;

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Notifications</p>
          <h1>Alerts, sync activity, and reminders</h1>
          <p className="meta-copy">
            Review budget pressure, payment activity, and security events in one feed.
          </p>
        </div>
        <div className="feature-actions">
          <button type="button" className="btn btn-outline-primary" onClick={loadNotifications}>
            Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={markAllRead} disabled={!unreadCount}>
            Mark all read
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Unread</span>
          <strong className="stat-value">{unreadCount}</strong>
          <p className="stat-copy">Items still waiting on your attention</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Warnings</span>
          <strong className="stat-value">{warningCount}</strong>
          <p className="stat-copy">Budget, balance, or security-related events</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Payments</span>
          <strong className="stat-value">{paymentCount}</strong>
          <p className="stat-copy">Recent payment and bill workflow updates</p>
        </article>
      </div>

      <section className="feature-card">
        <div className="feature-toolbar">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn ${activeFilter === option.value ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {isLoading ? (
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="empty-panel">
          <h3>No notifications in this view</h3>
          <p>Once budgets, sync jobs, and payments generate events, they will appear here.</p>
        </div>
      ) : (
        <div className="feature-list">
          {filteredNotifications.map((item) => (
            <article className="feature-list-item" key={item.id}>
              <div className="list-head">
                <div className="list-title">
                  <div className="inline-actions">
                    <span className={`badge-soft ${item.severity}`}>{item.severity}</span>
                    <span className={`status-chip ${item.is_read ? "read" : "unread"}`}>
                      {item.is_read ? "Read" : "Unread"}
                    </span>
                    <span className="badge-soft info">{item.notification_type.replaceAll("_", " ")}</span>
                  </div>
                  <h3>{item.title}</h3>
                </div>
                <p className="meta-copy">{formatTimestamp(item.created_at)}</p>
              </div>

              <p>{item.message}</p>

              {item.metadata && Object.keys(item.metadata).length ? (
                <div className="surface-block">
                  <p className="hint-copy">Metadata</p>
                  <pre className="code-card">{JSON.stringify(item.metadata, null, 2)}</pre>
                </div>
              ) : null}

              {!item.is_read ? (
                <div className="list-foot">
                  <button type="button" className="btn btn-outline-primary" onClick={() => markRead(item.id)}>
                    Mark read
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
