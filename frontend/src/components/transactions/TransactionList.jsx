import React, { useEffect, useState } from "react";
import axios, { buildApiUrl } from "../../api/axiosConfig";
import { Link } from "react-router-dom";
import { getStoredRole, isAdminRole, isManagerRole, ROLE_USER } from "../../utils/session";
import { formatCurrency } from "../../utils/formatters";
import "./TransactionList.css";

export default function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [pageInfo, setPageInfo] = useState({});
  const [userRole, setUserRole] = useState(ROLE_USER);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    account: "",
    transaction_type: "",
    min_amount: "",
    max_amount: "",
    category: "",
    description: "",
  });
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setUserRole(getStoredRole());
    loadTransactions();
    loadCategories();
  }, [currentPage]);

  const loadTransactions = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: page,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === "" || params[key] == null) {
          delete params[key];
        }
      });

      const response = await axios.get("/transactions/", { params });
      setTransactions(response.data.results || response.data);
      setPageInfo({
        next: response.data.next,
        previous: response.data.previous,
        count: response.data.count,
        totalPages: Math.ceil(response.data.count / (response.data.results?.length || 1))
      });
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setError("Failed to load transactions");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const [categoriesResponse, accountsResponse] = await Promise.all([
        axios.get("/categories/"),
        axios.get("/accounts/"),
      ]);
      setCategories(categoriesResponse.data.results || categoriesResponse.data);
      setAccounts(accountsResponse.data.results || accountsResponse.data);
    } catch (err) {
      console.error("Failed to load filters:", err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadTransactions(1);
  };

  const clearFilters = () => {
    setFilters({
      date_from: "",
      date_to: "",
      account: "",
      transaction_type: "",
      min_amount: "",
      max_amount: "",
      category: "",
      description: "",
    });
    setCurrentPage(1);
  };

  const handleDelete = async (id, description) => {
    if (!window.confirm(`Are you sure you want to delete "${description}"?`)) {
      return;
    }

    try {
      await axios.delete(`/transactions/${id}/`);
      // Reload transactions
      loadTransactions(currentPage);
    } catch (err) {
      alert("Failed to delete transaction");
      console.error("Delete error:", err);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadTransactions(page);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      const response = await fetch(`${buildApiUrl("/export/csv/")}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access")}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "transactions.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export CSV.");
    }
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="transaction-list-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="transaction-list-container">
      <div className="list-header">
        <div className="header-content">
          <h2>Transactions</h2>
          <p>Manage your income and expenses</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={handleExport}>
            Export CSV
          </button>
          <Link to="/transactions/new" className="btn btn-primary">
            + New Transaction
          </Link>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input
              type="date"
              className="form-control"
              name="date_from"
              value={filters.date_from}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input
              type="date"
              className="form-control"
              name="date_to"
              value={filters.date_to}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Account</label>
            <select
              className="form-select"
              name="account"
              value={filters.account}
              onChange={handleFilterChange}
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select
              className="form-select"
              name="transaction_type"
              value={filters.transaction_type}
              onChange={handleFilterChange}
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
              <option value="refund">Refund</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Min Amount</label>
            <input
              type="number"
              className="form-control"
              name="min_amount"
              value={filters.min_amount}
              onChange={handleFilterChange}
              step="0.01"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Max Amount</label>
            <input
              type="number"
              className="form-control"
              name="max_amount"
              value={filters.max_amount}
              onChange={handleFilterChange}
              step="0.01"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              className="form-select"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Description</label>
            <input
              type="text"
              className="form-control"
              name="description"
              value={filters.description}
              onChange={handleFilterChange}
              placeholder="Search descriptions..."
            />
          </div>
        </div>

        <div className="filter-actions">
          <button
            className="btn btn-outline-secondary"
            onClick={clearFilters}
          >
            Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={applyFilters}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button
            className="btn btn-sm btn-outline-danger ms-2"
            onClick={() => loadTransactions(currentPage)}
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <div className={`alert alert-${isAdminRole(userRole) ? "warning" : isManagerRole(userRole) ? "info" : "secondary"}`}>
          <small>
            {isAdminRole(userRole)
              ? "⚠️ Admin Mode: You can view and edit ALL user transactions. Changes affect user data directly."
              : isManagerRole(userRole)
                ? "ℹ️ Manager View: You can VIEW assigned users' transactions. Contact admin for changes."
                : "Viewing your personal transactions"}
          </small>
        </div>
      )}

      <div className="table-container">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>No transactions found</h3>
            <p>Get started by creating your first transaction</p>
            <Link to="/transactions/new" className="btn btn-primary">
              Create Transaction
            </Link>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(transaction => (
                    <tr key={transaction.id} className="transaction-row">
                      <td className="date-cell">
                        {formatDate(transaction.date)}
                      </td>
                      <td>{transaction.account_name}</td>
                      <td className="description-cell">
                        <div>{transaction.description}</div>
                        {transaction.merchant_name ? <small>{transaction.merchant_name}</small> : null}
                      </td>
                      <td className="category-cell">
                        {transaction.category_name || 'Uncategorized'}
                      </td>
                      <td>{transaction.transaction_type || "expense"}</td>
                      <td className={`amount-cell ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(Number(transaction.amount))}
                      </td>
                      <td className="actions-cell">
                        {isAdminRole(userRole) ? (
                          <>
                            <Link
                              to={`/transactions/${transaction.id}/edit`}
                              className="btn btn-sm btn-outline-primary me-1"
                              title="Edit transaction (Admin)"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(transaction.id, transaction.description)}
                              className="btn btn-sm btn-outline-danger"
                              title="Delete transaction (Admin)"
                            >
                              Delete
                            </button>
                          </>
                        ) : isManagerRole(userRole) ? (
                          <span className="meta-copy">View only</span>
                        ) : (
                          <>
                            <Link
                              to={`/transactions/${transaction.id}/edit`}
                              className="btn btn-sm btn-outline-primary me-1"
                              title="Edit transaction"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(transaction.id, transaction.description)}
                              className="btn btn-sm btn-outline-danger"
                              title="Delete transaction"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageInfo.totalPages > 1 && (
              <div className="pagination-container">
                <nav>
                  <ul className="pagination">
                    <li className={`page-item ${!pageInfo.previous ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pageInfo.previous}
                      >
                        Previous
                      </button>
                    </li>

                    {[...Array(pageInfo.totalPages)].map((_, index) => (
                      <li
                        key={index + 1}
                        className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(index + 1)}
                        >
                          {index + 1}
                        </button>
                      </li>
                    ))}

                    <li className={`page-item ${!pageInfo.next ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!pageInfo.next}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
                <div className="pagination-info">
                  Showing {transactions.length} of {pageInfo.count} transactions
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
