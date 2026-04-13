import React, { useEffect, useMemo, useState } from "react";

import axios from "../../api/axiosConfig";
import { formatCurrency } from "../../utils/formatters";
import "../common/FeatureWorkspace.css";

const initialForm = {
  account: "",
  symbol: "",
  name: "",
  asset_class: "stock",
  quantity: "",
  cost_basis: "",
  current_price: "",
  currency: "USD",
};

export default function InvestmentList() {
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [summary, setSummary] = useState({ base_currency: "USD", holdings: [] });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");
      const [accountsResponse, holdingsResponse, summaryResponse] = await Promise.all([
        axios.get("/accounts/"),
        axios.get("/investments/"),
        axios.get("/investments/summary/"),
      ]);
      setAccounts(accountsResponse.data.results || accountsResponse.data);
      setHoldings(holdingsResponse.data.results || holdingsResponse.data);
      setSummary(summaryResponse.data);
    } catch (err) {
      console.error("Failed to load investments", err);
      setError("Failed to load investment data.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleEdit(holding) {
    setEditingId(holding.id);
    setForm({
      account: holding.account || "",
      symbol: holding.symbol || "",
      name: holding.name || "",
      asset_class: holding.asset_class || "stock",
      quantity: holding.quantity ?? "",
      cost_basis: holding.cost_basis ?? "",
      current_price: holding.current_price ?? "",
      currency: holding.currency || "USD",
    });
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError("");
      const payload = {
        ...form,
        account: form.account || null,
        quantity: Number(form.quantity),
        cost_basis: Number(form.cost_basis),
        current_price: Number(form.current_price),
        currency: form.currency.toUpperCase(),
        symbol: form.symbol.toUpperCase(),
      };
      if (editingId) {
        await axios.patch(`/investments/${editingId}/`, payload);
        setSuccess("Holding updated.");
      } else {
        await axios.post("/investments/", payload);
        setSuccess("Holding created.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      console.error("Failed to save holding", err);
      setError("Failed to save holding.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(holding) {
    if (!window.confirm(`Delete ${holding.symbol}?`)) {
      return;
    }

    try {
      await axios.delete(`/investments/${holding.id}/`);
      setSuccess("Holding deleted.");
      await loadData();
    } catch (err) {
      setError("Failed to delete holding.");
    }
  }

  const summaryHoldings = useMemo(() => {
    const map = new Map();
    (summary.holdings || []).forEach((item) => map.set(item.id, item));
    return map;
  }, [summary.holdings]);

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Investments</p>
          <h1>Portfolio tracker</h1>
          <p className="meta-copy">
            Keep brokerage balances, ETF positions, and crypto allocations in your finance workspace.
          </p>
        </div>
        <div className="feature-actions">
          <button type="button" className="btn btn-outline-primary" onClick={loadData}>
            Refresh
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Portfolio value</span>
          <strong className="stat-value">
            {formatCurrency(summary.portfolio_value, summary.base_currency)}
          </strong>
          <p className="stat-copy">Converted to your base currency</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Cost basis</span>
          <strong className="stat-value">
            {formatCurrency(summary.total_cost_basis, summary.base_currency)}
          </strong>
          <p className="stat-copy">Total committed capital</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Unrealized gain/loss</span>
          <strong className="stat-value">
            {formatCurrency(summary.unrealized_gain_loss, summary.base_currency)}
          </strong>
          <p className="stat-copy">{holdings.length} active holding{holdings.length === 1 ? "" : "s"}</p>
        </article>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="dual-grid">
        <form className="feature-card" onSubmit={handleSubmit}>
          <div className="list-head">
            <div className="list-title">
              <p className="stat-label">Holding</p>
              <h2>{editingId ? "Update investment" : "Add investment"}</h2>
            </div>
            {editingId ? (
              <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Account</span>
              <select className="form-select" name="account" value={form.account} onChange={handleChange}>
                <option value="">Unassigned</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">Ticker</span>
              <input className="form-control" name="symbol" value={form.symbol} onChange={handleChange} required />
            </label>

            <label className="form-group">
              <span className="form-label">Display name</span>
              <input className="form-control" name="name" value={form.name} onChange={handleChange} />
            </label>

            <label className="form-group">
              <span className="form-label">Asset class</span>
              <select className="form-select" name="asset_class" value={form.asset_class} onChange={handleChange}>
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="mutual_fund">Mutual fund</option>
                <option value="crypto">Crypto</option>
                <option value="bond">Bond</option>
                <option value="cash">Cash</option>
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">Quantity</span>
              <input
                type="number"
                step="0.000001"
                className="form-control"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-group">
              <span className="form-label">Cost basis</span>
              <input
                type="number"
                step="0.01"
                className="form-control"
                name="cost_basis"
                value={form.cost_basis}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-group">
              <span className="form-label">Current price</span>
              <input
                type="number"
                step="0.01"
                className="form-control"
                name="current_price"
                value={form.current_price}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-group">
              <span className="form-label">Currency</span>
              <input
                maxLength={3}
                className="form-control"
                name="currency"
                value={form.currency}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <div className="form-actions">
            <p className="meta-copy">Use this to mirror sandbox brokerage positions or manual investments.</p>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingId ? "Update holding" : "Add holding"}
            </button>
          </div>
        </form>

        <section className="feature-card">
          <div className="list-head">
            <div className="list-title">
              <p className="stat-label">Portfolio</p>
              <h2>Current holdings</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="surface-stack">
              <div className="spinner-border text-primary" role="status" />
              <p className="meta-copy">Loading holdings...</p>
            </div>
          ) : holdings.length === 0 ? (
            <div className="empty-panel">
              <h3>No investments yet</h3>
              <p>Add your first holding to start tracking market value and gain/loss.</p>
            </div>
          ) : (
            <div className="feature-list">
              {holdings.map((holding) => {
                const converted = summaryHoldings.get(holding.id);
                return (
                  <article className="feature-list-item" key={holding.id}>
                    <div className="list-head">
                      <div className="list-title">
                        <div className="inline-actions">
                          <span className="badge-soft info">{holding.asset_class.replaceAll("_", " ")}</span>
                          {holding.account_name ? <span className="badge-soft success">{holding.account_name}</span> : null}
                        </div>
                        <h3>{holding.symbol}</h3>
                        <p>{holding.name || "Unnamed holding"}</p>
                      </div>
                      <div className="list-title">
                        <strong>{formatCurrency(holding.market_value, holding.currency)}</strong>
                        {converted ? (
                          <p>{formatCurrency(converted.market_value, summary.base_currency)} base value</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="triple-grid">
                      <div className="surface-block">
                        <p className="stat-label">Quantity</p>
                        <strong className="metric-inline">{holding.quantity}</strong>
                      </div>
                      <div className="surface-block">
                        <p className="stat-label">Cost basis</p>
                        <strong className="metric-inline">{formatCurrency(holding.cost_basis, holding.currency)}</strong>
                      </div>
                      <div className="surface-block">
                        <p className="stat-label">Current price</p>
                        <strong className="metric-inline">{formatCurrency(holding.current_price, holding.currency)}</strong>
                      </div>
                    </div>

                    <div className="list-foot">
                      <p className="meta-copy">
                        Unrealized P/L: {formatCurrency(holding.unrealized_gain_loss, holding.currency)}
                      </p>
                      <div className="feature-actions">
                        <button type="button" className="btn btn-outline-primary" onClick={() => handleEdit(holding)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={() => handleDelete(holding)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
