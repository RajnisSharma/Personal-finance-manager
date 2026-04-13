import React, { useEffect, useState } from "react";
import axios from "../api/axiosConfig";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminDashboard from "./dashboards/AdminDashboard";
import ManagerDashboard from "./dashboards/ManagerDashboard";
import { getStoredRole, isAdminRole, isManagerRole, ROLE_USER } from "../utils/session";
import { formatCurrency } from "../utils/formatters";
import "./Dashboard.css";

const COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#6d28d9", "#0f172a"];

export default function Dashboard() {
  const [userRole, setUserRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedRole = getStoredRole();
    setUserRole(storedRole);

    async function fetchRole() {
      try {
        const response = await axios.get("/auth/profile/");
        setUserRole(response.data.role);
      } catch (err) {
        console.error("Failed to fetch user role:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRole();
  }, []);

  if (isLoading && !userRole) {
    return (
      <div className="dashboard-state">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (isAdminRole(userRole)) {
    return <AdminDashboard />;
  }

  if (isManagerRole(userRole)) {
    return <ManagerDashboard />;
  }

  return <UserDashboard />;
}

function UserDashboard() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      setError("");

      const response = await axios.get("/dashboard/summary/");
      setSummary(response.data);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-state">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-state">
        <div className="alert alert-danger">{error}</div>
        <button className="btn btn-primary" onClick={loadDashboardData}>
          Retry
        </button>
      </div>
    );
  }

  const accounts = summary?.accounts || [];
  const baseCurrency = summary?.base_currency || "USD";
  const categoryData = (summary?.spending_by_category || []).map((item) => ({
    ...item,
    value: Number(item.value),
  }));
  const monthlyCashflow = (summary?.monthly_cashflow || []).map((item) => ({
    ...item,
    income: Number(item.income),
    expense: Number(item.expense),
  }));
  const topTransactions = summary?.top_transactions || [];
  const budgetAlerts = (summary?.budgets || []).filter((item) => item.alert_triggered);
  const goals = summary?.goals || [];

  return (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Financial command center</h1>
          <p className="dashboard-subtitle">
            Track net worth, monthly spending, budget pressure, and goal momentum from one place.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Net worth</span>
          <strong>{formatCurrency(summary?.net_worth, baseCurrency)}</strong>
          <p>{accounts.length} linked or manual accounts</p>
        </article>
        <article className="metric-card">
          <span>Available cash</span>
          <strong>{formatCurrency(summary?.available_cash, baseCurrency)}</strong>
          <p>Balances ready to spend or move</p>
        </article>
        <article className="metric-card">
          <span>Income this period</span>
          <strong>{formatCurrency(summary?.income_total, baseCurrency)}</strong>
          <p>Savings delta {formatCurrency(summary?.savings_delta, baseCurrency)}</p>
        </article>
        <article className="metric-card">
          <span>Budget alerts</span>
          <strong>{summary?.budget_alerts || 0}</strong>
          <p>{budgetAlerts.length ? "Review warning budgets below" : "All budgets healthy"}</p>
        </article>
        <article className="metric-card">
          <span>Portfolio</span>
          <strong>{formatCurrency(summary?.portfolio?.portfolio_value, baseCurrency)}</strong>
          <p>{summary?.unread_notifications || 0} unread notifications</p>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card chart-card">
          <div className="card-header-row">
            <div>
              <p className="eyebrow">Spending mix</p>
              <h3>Spend by category</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={95}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value, baseCurrency)} />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="dashboard-card chart-card">
          <div className="card-header-row">
            <div>
              <p className="eyebrow">Trend</p>
              <h3>Six-month cashflow</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyCashflow}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value, baseCurrency)} />
              <Bar dataKey="income" fill="#0f766e" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" fill="#be123c" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <div className="card-header-row">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>Balance snapshot</h3>
            </div>
          </div>
          <div className="list-stack">
            {accounts.map((account) => (
              <div className="list-row" key={account.id}>
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.institution_name || account.provider}</p>
                </div>
                <div className="row-end">
                  <strong>{formatCurrency(account.balance, account.currency)}</strong>
                  <p>{account.account_type}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="card-header-row">
            <div>
              <p className="eyebrow">Budgets</p>
              <h3>Pressure points</h3>
            </div>
          </div>
          <div className="list-stack">
            {(summary?.budgets || []).slice(0, 4).map((budget) => (
              <div className="budget-row" key={budget.id}>
                <div className="budget-row-top">
                  <strong>{budget.name}</strong>
                  <span className={`status-badge status-${budget.status}`}>{budget.status.replace("_", " ")}</span>
                </div>
                <div className="progress-shell">
                  <div className="progress-fill" style={{ width: `${Math.min(Number(budget.usage_percentage), 100)}%` }} />
                </div>
                <div className="budget-row-meta">
                  <span>{formatCurrency(budget.spent_amount, baseCurrency)} spent</span>
                  <span>{formatCurrency(budget.limit_amount, baseCurrency)} limit</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="card-header-row">
            <div>
              <p className="eyebrow">Goals</p>
              <h3>Progress and forecast</h3>
            </div>
          </div>
          <div className="list-stack">
            {goals.slice(0, 4).map((goal) => (
              <div className="goal-row" key={goal.id}>
                <div className="budget-row-top">
                  <strong>{goal.name}</strong>
                  <span className={`status-badge ${goal.is_on_track ? "status-healthy" : "status-warning"}`}>
                    {goal.is_on_track ? "On track" : "Needs attention"}
                  </span>
                </div>
                <div className="progress-shell">
                  <div className="progress-fill" style={{ width: `${Math.min(Number(goal.progress_percentage), 100)}%` }} />
                </div>
                <div className="budget-row-meta">
                  <span>{formatCurrency(goal.current_amount, baseCurrency)} of {formatCurrency(goal.target_amount, baseCurrency)}</span>
                  <span>
                    {goal.estimated_completion_date
                      ? `Forecast ${new Date(goal.estimated_completion_date).toLocaleDateString()}`
                      : "Forecast unavailable"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="card-header-row">
            <div>
              <p className="eyebrow">Transactions</p>
              <h3>Largest movements</h3>
            </div>
          </div>
          <div className="list-stack">
            {topTransactions.map((transaction) => (
              <div className="list-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <p>{transaction.category_name}</p>
                </div>
                <div className="row-end">
                  <strong>{formatCurrency(transaction.amount, baseCurrency)}</strong>
                  <p>{new Date(transaction.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
