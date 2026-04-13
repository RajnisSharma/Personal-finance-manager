import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import axios from "../../api/axiosConfig";
import "./AccountList.css";


const currencyFormatter = (currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });


export default function AccountList() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.get("/accounts/");
      setAccounts(response.data.results || response.data);
    } catch (err) {
      setError("Failed to load accounts.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (account) => {
    const confirmed = window.confirm(`Delete ${account.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`/accounts/${account.id}/`);
      await loadAccounts();
    } catch (err) {
      setError("Failed to delete account.");
    }
  };

  if (isLoading) {
    return (
      <div className="account-list-state">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading accounts...</p>
      </div>
    );
  }

  return (
    <section className="account-list-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Accounts</p>
          <h1>Linked and manual accounts</h1>
          <p className="page-subtitle">
            Keep checking, savings, cards, investments, and loans in one place.
          </p>
        </div>
        <Link to="/accounts/new" className="btn btn-primary">
          Add Account
        </Link>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {accounts.length === 0 ? (
        <div className="empty-panel">
          <h3>No accounts yet</h3>
          <p>Create your first account so transactions, budgets, and goals have a home.</p>
          <Link to="/accounts/new" className="btn btn-primary">
            Create account
          </Link>
        </div>
      ) : (
        <div className="account-grid">
          {accounts.map((account) => {
            const formatter = currencyFormatter(account.currency);
            return (
              <article key={account.id} className="account-card">
                <div className="account-card-top">
                  <div>
                    <p className="account-provider">{account.institution_name || account.provider}</p>
                    <h3>{account.name}</h3>
                  </div>
                  <span className={`status-pill status-${account.link_status}`}>
                    {account.link_status}
                  </span>
                </div>

                <div className="account-balance">
                  <span>Current balance</span>
                  <strong>{formatter.format(Number(account.balance || 0))}</strong>
                </div>

                <div className="account-meta">
                  <div>
                    <span>Available</span>
                    <strong>{formatter.format(Number(account.available_balance || 0))}</strong>
                  </div>
                  <div>
                    <span>Type</span>
                    <strong>{account.account_type}</strong>
                  </div>
                  <div>
                    <span>Currency</span>
                    <strong>{account.currency}</strong>
                  </div>
                  <div>
                    <span>Last sync</span>
                    <strong>
                      {account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : "Not synced"}
                    </strong>
                  </div>
                </div>

                <div className="account-actions">
                  <Link to={`/accounts/${account.id}/edit`} className="btn btn-outline-primary">
                    Edit
                  </Link>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => handleDelete(account)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
