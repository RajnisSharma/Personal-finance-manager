import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../api/axiosConfig";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  isAdminRole,
  isManagerRole,
  getStoredRole,
  canGenerateSystemReports,
  canGenerateAssignedReports,
} from "../utils/session";
import "./common/FeatureWorkspace.css";

const COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#6d28d9", "#0f172a", "#059669", "#7c3aed"];

const REPORT_TYPES = {
  personal: [
    { value: "cashflow", label: "Cash Flow Analysis" },
    { value: "spending", label: "Spending Breakdown" },
    { value: "income", label: "Income Summary" },
    { value: "budget", label: "Budget Performance" },
    { value: "goals", label: "Goals Progress" },
    { value: "networth", label: "Net Worth Trend" },
  ],
  manager: [
    { value: "client_summary", label: "Client Summary" },
    { value: "portfolio_overview", label: "Portfolio Overview" },
    { value: "alerts_summary", label: "Alerts Summary" },
  ],
  admin: [
    { value: "system_usage", label: "System Usage" },
    { value: "user_activity", label: "User Activity" },
    { value: "platform_growth", label: "Platform Growth" },
  ],
};

export default function Reports() {
  const role = getStoredRole();
  const isAdmin = isAdminRole(role);
  const isManager = isManagerRole(role);

  const [reportType, setReportType] = useState("cashflow");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [selectedUser, setSelectedUser] = useState("");
  const [managedUsers, setManagedUsers] = useState([]);

  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isManager || isAdmin) {
      loadManagedUsers();
    }
  }, []);

  async function loadManagedUsers() {
    try {
      const response = await axios.get("/auth/management/users/");
      setManagedUsers(response.data.filter((u) => u.role === "user"));
    } catch (err) {
      console.error("Failed to load managed users", err);
    }
  }

  async function generateReport() {
    try {
      setIsLoading(true);
      setError("");

      let endpoint = "/reports/";
      let params = {
        type: reportType,
        start_date: dateRange.start,
        end_date: dateRange.end,
      };

      if ((isManager || isAdmin) && selectedUser) {
        params.user_id = selectedUser;
      }

      const response = await axios.get(`${endpoint}?${new URLSearchParams(params)}`);
      setReportData(response.data);
    } catch (err) {
      console.error("Failed to generate report", err);
      setError("Failed to generate report. Please try again.");

      setReportData(generateMockReport(reportType));
    } finally {
      setIsLoading(false);
    }
  }

  function generateMockReport(type) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

    switch (type) {
      case "cashflow":
        return {
          title: "Cash Flow Analysis",
          summary: {
            total_income: 45000,
            total_expense: 32000,
            net_savings: 13000,
            savings_rate: 28.9,
          },
          chart_data: months.map((month) => ({
            month,
            income: 7500 + Math.random() * 2000,
            expense: 5000 + Math.random() * 1500,
          })),
        };

      case "spending":
        return {
          title: "Spending Breakdown",
          chart_data: [
            { name: "Housing", value: 12000 },
            { name: "Food", value: 6000 },
            { name: "Transport", value: 4500 },
            { name: "Entertainment", value: 3500 },
            { name: "Utilities", value: 3000 },
            { name: "Healthcare", value: 2000 },
            { name: "Shopping", value: 1000 },
          ],
        };

      case "client_summary":
        return {
          title: "Client Summary",
          summary: {
            total_clients: managedUsers.length || 5,
            total_net_worth: 1250000,
            avg_portfolio: 250000,
            clients_with_alerts: 2,
          },
          chart_data: (managedUsers.length ? managedUsers : [
            { username: "john_doe", financial_snapshot: { net_worth: 150000 } },
            { username: "jane_smith", financial_snapshot: { net_worth: 280000 } },
            { username: "bob_jones", financial_snapshot: { net_worth: 195000 } },
          ]).map((u) => ({
            name: u.username,
            net_worth: u.financial_snapshot?.net_worth || Math.random() * 300000,
          })),
        };

      case "system_usage":
        return {
          title: "System Usage Statistics",
          summary: {
            total_users: 150,
            active_users: 134,
            total_transactions: 45230,
            total_accounts: 340,
          },
          chart_data: months.map((month) => ({
            month,
            active_users: 100 + Math.random() * 50,
            new_users: 5 + Math.random() * 15,
          })),
        };

      default:
        return {
          title: "Financial Report",
          summary: { message: "Select a report type to view detailed analytics" },
        };
    }
  }

  function exportReport(format) {
    if (!reportData) return;

    const dataStr = format === "json" 
      ? JSON.stringify(reportData, null, 2)
      : convertToCSV(reportData);
    
    const blob = new Blob([dataStr], { 
      type: format === "json" ? "application/json" : "text/csv" 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-report-${reportType}-${new Date().toISOString().split("T")[0]}.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function convertToCSV(data) {
    if (!data.chart_data) return "";
    
    const headers = Object.keys(data.chart_data[0]).join(",");
    const rows = data.chart_data.map((row) => Object.values(row).join(","));
    return [headers, ...rows].join("\n");
  }

  const availableReportTypes = [
    ...REPORT_TYPES.personal,
    ...(isManager || isAdmin ? REPORT_TYPES.manager : []),
    ...(isAdmin ? REPORT_TYPES.admin : []),
  ];

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Analytics</p>
          <h1>Financial Reports</h1>
          <p className="meta-copy">
            {isAdmin
              ? "Generate comprehensive system-wide reports and analytics."
              : isManager
              ? "Create detailed reports for your assigned clients."
              : "Analyze your personal financial data with detailed reports."}
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="feature-card">
        <div className="list-title">
          <p className="stat-label">Report Configuration</p>
          <h2>Generate Report</h2>
        </div>

        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Report Type</span>
            <select
              className="form-select"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {availableReportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          {(isManager || isAdmin) && (
            <label className="form-group">
              <span className="form-label">Client (Optional)</span>
              <select
                className="form-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">All / My Data</option>
                {managedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-group">
            <span className="form-label">Start Date</span>
            <input
              type="date"
              className="form-control"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
            />
          </label>

          <label className="form-group">
            <span className="form-label">End Date</span>
            <input
              type="date"
              className="form-control"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
            />
          </label>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={generateReport}
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </section>

      {reportData && (
        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Results</p>
            <h2>{reportData.title || "Report Results"}</h2>
          </div>

          {reportData.summary && (
            <div className="stats-grid">
              {Object.entries(reportData.summary).map(([key, value]) => (
                <article className="stat-card" key={key}>
                  <span className="stat-label">
                    {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  <strong className="stat-value">
                    {typeof value === "number" && value > 1000
                      ? value.toLocaleString()
                      : typeof value === "number"
                      ? value.toFixed(2)
                      : value}
                  </strong>
                </article>
              ))}
            </div>
          )}

          {reportData.chart_data && reportData.chart_data.length > 0 && (
            <div className="chart-container" style={{ marginTop: "2rem" }}>
              {reportType === "cashflow" || reportType === "system_usage" ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="income" fill="#0f766e" name="Income" />
                    <Bar dataKey="expense" fill="#be123c" name="Expense" />
                    {reportData.chart_data[0]?.active_users && (
                      <Bar dataKey="active_users" fill="#1d4ed8" name="Active Users" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              ) : reportType === "spending" ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.chart_data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {reportData.chart_data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => value.toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="net_worth" fill="#0f766e" name="Net Worth" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <p className="meta-copy">Export this report for offline analysis or sharing.</p>
            <div className="button-group">
              <button
                className="btn btn-outline-primary"
                onClick={() => exportReport("json")}
              >
                Export JSON
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() => exportReport("csv")}
              >
                Export CSV
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="feature-card">
        <div className="list-title">
          <p className="stat-label">Quick Access</p>
          <h2>Other Report Options</h2>
        </div>

        <div className="feature-list">
          <article className="feature-list-item">
            <div className="list-head">
              <div>
                <strong>Transaction History</strong>
                <p>View and filter all your transactions</p>
              </div>
              <Link className="btn btn-sm btn-outline-primary" to="/transactions">
                View
              </Link>
            </div>
          </article>

          <article className="feature-list-item">
            <div className="list-head">
              <div>
                <strong>Budget Performance</strong>
                <p>Check how your budgets are performing</p>
              </div>
              <Link className="btn btn-sm btn-outline-primary" to="/budgets">
                View
              </Link>
            </div>
          </article>

          {(isManager || isAdmin) && (
            <article className="feature-list-item">
              <div className="list-head">
                <div>
                  <strong>User Management</strong>
                  <p>Manage users and view their reports</p>
                </div>
                <Link className="btn btn-sm btn-outline-primary" to="/management/users">
                  View
                </Link>
              </div>
            </article>
          )}
        </div>
      </section>
    </section>
  );
}
