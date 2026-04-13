import React, { useEffect, useState } from "react";
import axios from "../../api/axiosConfig";
import { Link } from "react-router-dom";
import { getStoredRole, isAdminRole, isManagerRole, ROLE_USER } from "../../utils/session";
import { formatCurrency } from "../../utils/formatters";
import "./BudgetList.css";

export default function BudgetList() {
  const [budgets, setBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(ROLE_USER);

  useEffect(() => {
    setUserRole(getStoredRole());
    loadBudgets();
  }, []);

  async function loadBudgets() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get("/budgets/");
      setBudgets(response.data.results || response.data);
    } catch (err) {
      console.error("Failed to load budgets:", err);
      setError("Failed to load budgets");
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" budget?`)) {
      return;
    }

    try {
      await axios.delete(`/budgets/${id}/`);
      loadBudgets();
    } catch (err) {
      alert("Failed to delete budget");
    }
  };

  if (isLoading) {
    return (
      <div className="budget-list-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading budgets...</p>
      </div>
    );
  }

  return (
    <div className="budget-list-container">
      <div className="list-header">
        <div className="header-content">
          <h2>Budgets</h2>
          <p>Manage your spending limits</p>
        </div>
        <Link to="/budgets/new" className="btn btn-primary">
          + New Budget
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button
            className="btn btn-sm btn-outline-danger ms-2"
            onClick={loadBudgets}
          >
            Retry
          </button>
        </div>
      )}

      <div className="table-container">
        {budgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3>No budgets found</h3>
            <p>Create your first budget to start tracking spending</p>
            <Link to="/budgets/new" className="btn btn-primary">
              Create Budget
            </Link>
          </div>
        ) : (
          <div className="budget-card-grid">
            {budgets.map((budget) => (
              <article key={budget.id} className="budget-card">
                <div className="budget-card-head">
                  <div>
                    <p className="budget-label">{budget.period}</p>
                    <h3>{budget.name || budget.category_name || "Overall budget"}</h3>
                  </div>
                  <span className={`budget-status budget-${budget.status}`}>{budget.status.replace("_", " ")}</span>
                </div>

                <div className="budget-amount-row">
                  <strong>{formatCurrency(budget.spent_amount)}</strong>
                  <span>of {formatCurrency(budget.limit_amount)}</span>
                </div>

                <div className="progress-shell">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(Number(budget.usage_percentage), 100)}%` }}
                  />
                </div>

                <div className="budget-meta-row">
                  <span>{formatCurrency(budget.remaining_amount)} remaining</span>
                  <span>{Number(budget.alert_threshold).toFixed(0)}% alert</span>
                </div>

                <div className="budget-actions">
                  {isAdminRole(userRole) ? (
                    <>
                      <Link to={`/budgets/${budget.id}/edit`} className="btn btn-sm btn-outline-primary">
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(budget.id, budget.name || budget.category_name || "budget")}
                        className="btn btn-sm btn-outline-danger"
                      >
                        Delete
                      </button>
                    </>
                  ) : isManagerRole(userRole) ? (
                    <span className="meta-copy">View only</span>
                  ) : (
                    <>
                      <Link to={`/budgets/${budget.id}/edit`} className="btn btn-sm btn-outline-primary">
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(budget.id, budget.name || budget.category_name || "budget")}
                        className="btn btn-sm btn-outline-danger"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
