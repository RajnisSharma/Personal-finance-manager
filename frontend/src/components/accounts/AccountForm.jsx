import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import axios from "../../api/axiosConfig";
import "./AccountForm.css";


const initialForm = {
  name: "",
  provider: "manual",
  institution_name: "",
  account_type: "checking",
  currency: "USD",
  balance: "",
  available_balance: "",
  link_status: "manual",
  consent_expires_at: "",
};


export default function AccountForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      loadAccount();
    }
  }, [isEdit, id]);

  const loadAccount = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/accounts/${id}/`);
      const account = response.data;
      setForm({
        name: account.name || "",
        provider: account.provider || "manual",
        institution_name: account.institution_name || "",
        account_type: account.account_type || "checking",
        currency: account.currency || "USD",
        balance: account.balance ?? "",
        available_balance: account.available_balance ?? "",
        link_status: account.link_status || "manual",
        consent_expires_at: account.consent_expires_at ? account.consent_expires_at.slice(0, 16) : "",
      });
    } catch (err) {
      setErrors({ general: "Failed to load account." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: "" }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = "Account name is required.";
    }
    if (!form.provider.trim()) {
      nextErrors.provider = "Provider is required.";
    }
    if (!form.balance && form.balance !== 0) {
      nextErrors.balance = "Balance is required.";
    }
    if (!form.available_balance && form.available_balance !== 0) {
      nextErrors.available_balance = "Available balance is required.";
    }
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...form,
        balance: Number(form.balance),
        available_balance: Number(form.available_balance),
        consent_expires_at: form.consent_expires_at || null,
      };
      if (isEdit) {
        await axios.patch(`/accounts/${id}/`, payload);
      } else {
        await axios.post("/accounts/", payload);
      }
      navigate("/accounts");
    } catch (err) {
      setErrors(err.response?.data || { general: "Failed to save account." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="account-form-state">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading account...</p>
      </div>
    );
  }

  return (
    <section className="account-form-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Accounts</p>
          <h1>{isEdit ? "Edit account" : "Add account"}</h1>
          <p className="page-subtitle">
            Use this for manual accounts or sandbox-linked accounts until a live bank provider is connected.
          </p>
        </div>
      </div>

      <form className="account-form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Account name</span>
            <input className="form-control" name="name" value={form.name} onChange={handleChange} />
            {errors.name ? <span className="field-error">{errors.name}</span> : null}
          </label>

          <label className="form-group">
            <span className="form-label">Provider</span>
            <input className="form-control" name="provider" value={form.provider} onChange={handleChange} />
            {errors.provider ? <span className="field-error">{errors.provider}</span> : null}
          </label>

          <label className="form-group">
            <span className="form-label">Institution</span>
            <input
              className="form-control"
              name="institution_name"
              value={form.institution_name}
              onChange={handleChange}
            />
          </label>

          <label className="form-group">
            <span className="form-label">Account type</span>
            <select className="form-select" name="account_type" value={form.account_type} onChange={handleChange}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit card</option>
              <option value="investment">Investment</option>
              <option value="loan">Loan</option>
            </select>
          </label>

          <label className="form-group">
            <span className="form-label">Currency</span>
            <input className="form-control" name="currency" value={form.currency} onChange={handleChange} maxLength={3} />
          </label>

          <label className="form-group">
            <span className="form-label">Link status</span>
            <select className="form-select" name="link_status" value={form.link_status} onChange={handleChange}>
              <option value="manual">Manual</option>
              <option value="linked">Linked</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
              <option value="revoked">Revoked</option>
            </select>
          </label>

          <label className="form-group">
            <span className="form-label">Current balance</span>
            <input
              className="form-control"
              type="number"
              step="0.01"
              name="balance"
              value={form.balance}
              onChange={handleChange}
            />
            {errors.balance ? <span className="field-error">{errors.balance}</span> : null}
          </label>

          <label className="form-group">
            <span className="form-label">Available balance</span>
            <input
              className="form-control"
              type="number"
              step="0.01"
              name="available_balance"
              value={form.available_balance}
              onChange={handleChange}
            />
            {errors.available_balance ? <span className="field-error">{errors.available_balance}</span> : null}
          </label>

          <label className="form-group full-width">
            <span className="form-label">Consent expires at</span>
            <input
              className="form-control"
              type="datetime-local"
              name="consent_expires_at"
              value={form.consent_expires_at}
              onChange={handleChange}
            />
          </label>
        </div>

        {errors.general ? <div className="alert alert-danger">{errors.general}</div> : null}

        <div className="form-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/accounts")}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Update account" : "Create account"}
          </button>
        </div>
      </form>
    </section>
  );
}
