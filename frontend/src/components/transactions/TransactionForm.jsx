import React, { useState, useEffect } from "react";
import axios from "../../api/axiosConfig";
import { useNavigate, useParams } from "react-router-dom";
import "./TransactionForm.css";

export default function TransactionForm() {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    account: "",
    description: "",
    merchant_name: "",
    notes: "",
    transaction_type: "expense",
    amount: "",
    category: "",
    is_recurring: false,
    recurring_frequency: "",
    next_occurrence_date: "",
  });
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const params = useParams();
  const isEdit = !!params.id;

  useEffect(() => {
    loadCategories();
    loadAccounts();
    if (isEdit) {
      loadTransaction();
    }
  }, [isEdit, params.id]);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get("/categories/");
      setCategories(response.data.results || response.data);
    } catch (err) {
      setErrors({ general: "Failed to load categories" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await axios.get("/accounts/");
      setAccounts(response.data.results || response.data);
    } catch (err) {
      setErrors({ general: "Failed to load accounts" });
    }
  };

  const loadTransaction = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/transactions/${params.id}/`);
      const transaction = response.data;
      setForm({
        date: transaction.date,
        account: transaction.account,
        description: transaction.description || "",
        merchant_name: transaction.merchant_name || "",
        notes: transaction.notes || "",
        transaction_type: transaction.transaction_type || (Number(transaction.amount) >= 0 ? "income" : "expense"),
        amount: Math.abs(Number(transaction.amount)),
        category: transaction.category || "",
        is_recurring: Boolean(transaction.is_recurring),
        recurring_frequency: transaction.recurring_frequency || "",
        next_occurrence_date: transaction.next_occurrence_date || "",
      });
    } catch (err) {
      setErrors({ general: "Failed to load transaction" });
      navigate("/transactions");
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.date) newErrors.date = "Date is required";
    if (!form.account) newErrors.account = "Account is required";
    if (!form.amount || parseFloat(form.amount) <= 0) {
      newErrors.amount = "Valid amount is required";
    }
    if (!form.description?.trim()) {
      newErrors.description = "Description is required";
    }
    if (form.is_recurring && !form.recurring_frequency) {
      newErrors.recurring_frequency = "Recurring frequency is required";
    }
    
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const submitData = {
        ...form,
        amount: parseFloat(form.amount),
        category: form.category || null,
        next_occurrence_date: form.next_occurrence_date || null,
      };

      if (isEdit) {
        await axios.patch(`/transactions/${params.id}/`, submitData);
      } else {
        await axios.post("/transactions/", submitData);
      }
      
      navigate("/transactions");
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') {
          setErrors({ general: errorData });
        } else if (errorData.detail) {
          setErrors({ general: errorData.detail });
        } else {
          setErrors(errorData);
        }
      } else {
        setErrors({ general: "Failed to save transaction" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/transactions");
  };

  if (isLoading) {
    return (
      <div className="transaction-form-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading {isEdit ? 'transaction' : 'categories'}...</p>
      </div>
    );
  }

  return (
    <div className="transaction-form-container">
      <div className="form-header">
        <h2>{isEdit ? "Edit Transaction" : "New Transaction"}</h2>
        <p>{isEdit ? "Update your transaction details" : "Add a new income or expense"}</p>
      </div>

      <form onSubmit={handleSubmit} className="transaction-form">
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="date" className="form-label">
              Date *
            </label>
            <input
              id="date"
              type="date"
              className={`form-control ${errors.date ? 'is-invalid' : ''}`}
              name="date"
              value={form.date}
              onChange={handleChange}
              required
            />
            {errors.date && (
              <div className="invalid-feedback">{errors.date}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="account" className="form-label">
              Account *
            </label>
            <select
              id="account"
              className={`form-select ${errors.account ? 'is-invalid' : ''}`}
              name="account"
              value={form.account}
              onChange={handleChange}
              required
            >
              <option value="">Select Account</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.provider})
                </option>
              ))}
            </select>
            {errors.account && (
              <div className="invalid-feedback">{errors.account}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="amount" className="form-label">
              Amount *
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                className={`form-control ${errors.amount ? 'is-invalid' : ''}`}
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
            {errors.amount && (
              <div className="invalid-feedback">{errors.amount}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="transaction_type" className="form-label">
              Type *
            </label>
            <select
              id="transaction_type"
              className="form-select"
              name="transaction_type"
              value={form.transaction_type}
              onChange={handleChange}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
              <option value="refund">Refund</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="category" className="form-label">
              Category
            </label>
            <select
              id="category"
              className="form-select"
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="">Select a category (optional)</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group full-width">
            <label htmlFor="description" className="form-label">
              Description *
            </label>
            <input
              id="description"
              type="text"
              className={`form-control ${errors.description ? 'is-invalid' : ''}`}
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter a description"
              required
            />
            {errors.description && (
              <div className="invalid-feedback">{errors.description}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="merchant_name" className="form-label">
              Merchant
            </label>
            <input
              id="merchant_name"
              type="text"
              className="form-control"
              name="merchant_name"
              value={form.merchant_name}
              onChange={handleChange}
              placeholder="Optional merchant name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="is_recurring" className="form-label">
              Recurring
            </label>
            <select
              id="is_recurring"
              className="form-select"
              name="is_recurring"
              value={String(form.is_recurring)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  is_recurring: event.target.value === "true",
                  recurring_frequency: event.target.value === "true" ? current.recurring_frequency : "",
                  next_occurrence_date: event.target.value === "true" ? current.next_occurrence_date : "",
                }))
              }
            >
              <option value="false">One-time</option>
              <option value="true">Recurring</option>
            </select>
          </div>

          {form.is_recurring ? (
            <>
              <div className="form-group">
                <label htmlFor="recurring_frequency" className="form-label">
                  Frequency
                </label>
                <select
                  id="recurring_frequency"
                  className={`form-select ${errors.recurring_frequency ? "is-invalid" : ""}`}
                  name="recurring_frequency"
                  value={form.recurring_frequency}
                  onChange={handleChange}
                >
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
                {errors.recurring_frequency ? (
                  <div className="invalid-feedback">{errors.recurring_frequency}</div>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="next_occurrence_date" className="form-label">
                  Next occurrence
                </label>
                <input
                  id="next_occurrence_date"
                  type="date"
                  className="form-control"
                  name="next_occurrence_date"
                  value={form.next_occurrence_date}
                  onChange={handleChange}
                />
              </div>
            </>
          ) : null}

          <div className="form-group full-width">
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              id="notes"
              className="form-control"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Optional notes"
              rows={3}
            />
          </div>
        </div>

        {errors.general && (
          <div className="alert alert-danger">{errors.general}</div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                {isEdit ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEdit ? "Update Transaction" : "Create Transaction"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
