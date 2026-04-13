import React, { useEffect, useState } from "react";

import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";

const defaultSettings = {
  site_name: "Personal Finance Manager",
  allow_self_registration: true,
  default_base_currency: "USD",
  support_email: "",
  maintenance_mode: false,
};

export default function SystemSettings() {
  const [form, setForm] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.get("/auth/system-settings/");
      setForm({
        site_name: response.data.site_name || defaultSettings.site_name,
        allow_self_registration: Boolean(response.data.allow_self_registration),
        default_base_currency: response.data.default_base_currency || "USD",
        support_email: response.data.support_email || "",
        maintenance_mode: Boolean(response.data.maintenance_mode),
      });
    } catch (err) {
      console.error("Failed to load system settings", err);
      setError("Failed to load system settings.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError("");
      setSuccess("");
      await axios.patch("/auth/system-settings/", {
        ...form,
        default_base_currency: form.default_base_currency.toUpperCase(),
      });
      setSuccess("System settings updated.");
    } catch (err) {
      console.error("Failed to update system settings", err);
      setError("Failed to update system settings.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading system settings...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Administrator</p>
          <h1>System settings</h1>
          <p className="meta-copy">
            Control platform-wide registration access, branding, and operational flags.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <form className="feature-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Site name</span>
            <input className="form-control" name="site_name" value={form.site_name} onChange={handleChange} />
          </label>

          <label className="form-group">
            <span className="form-label">Support email</span>
            <input className="form-control" type="email" name="support_email" value={form.support_email} onChange={handleChange} />
          </label>

          <label className="form-group">
            <span className="form-label">Default base currency</span>
            <select className="form-select" name="default_base_currency" value={form.default_base_currency} onChange={handleChange}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="INR">INR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>

          <label className="form-group toggle-row full-width">
            <input type="checkbox" name="allow_self_registration" checked={form.allow_self_registration} onChange={handleChange} />
            <span>Allow public self-registration</span>
          </label>

          <label className="form-group toggle-row full-width">
            <input type="checkbox" name="maintenance_mode" checked={form.maintenance_mode} onChange={handleChange} />
            <span>Maintenance mode</span>
          </label>
        </div>

        <div className="form-actions">
          <p className="meta-copy">Disable self-registration when onboarding is handled manually by administrators.</p>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save system settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
