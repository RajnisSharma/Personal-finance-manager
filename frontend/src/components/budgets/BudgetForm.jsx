import React, { useState, useEffect } from "react";
import axios from "../../api/axiosConfig";
import { useNavigate, useParams } from "react-router-dom";
import { getStoredRole, ROLE_MANAGER } from "../../utils/session";
import './BudgetForm.css';

export default function BudgetForm() {
  const [form, setForm] = useState({
    name: "",
    category: "",
    period: "monthly",
    limit_amount: "",
    alert_threshold: "90",
    user: "", // for managers
  });
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const params = useParams();
  const isEdit = !!params.id;
  const role = getStoredRole();
  const isManager = role === ROLE_MANAGER;

  useEffect(() => {
    loadCategories();
    if (isManager) {
      loadUsers();
    }
    if (isEdit) {
      loadBudget();
    }
  }, [isEdit, params.id, isManager]);

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

  const loadUsers = async () => {
    try {
      const response = await axios.get("/auth/management/users/");
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const loadBudget = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/budgets/${params.id}/`);
      const budget = response.data;
      setForm({
        name: budget.name || "",
        category: budget.category || "",
        period: budget.period,
        limit_amount: budget.limit_amount,
        alert_threshold: budget.alert_threshold || "90",
      });
    } catch (err) {
      setErrors({ general: "Failed to load budget" });
      navigate("/budgets");
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.limit_amount || parseFloat(form.limit_amount) <= 0) {
      newErrors.limit_amount = "Valid limit amount is required";
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
        limit_amount: parseFloat(form.limit_amount),
        alert_threshold: parseFloat(form.alert_threshold),
        category: form.category || null,
      };

      if (isManager && form.user) {
        submitData.user = form.user;
      }

      if (isEdit) {
        await axios.patch(`/budgets/${params.id}/`, submitData);
      } else {
        await axios.post("/budgets/", submitData);
      }

      navigate("/budgets");
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') {
          setErrors({ general: errorData });
        } else {
          setErrors(errorData);
        }
      } else {
        setErrors({ general: "Failed to save budget" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/budgets");
  };

  if (isLoading) {
    return (
      <div className="budget-form-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading {isEdit ? 'budget' : 'categories'}...</p>
      </div>
    );
  }

  return (
    <div className="budget-form-container">
      <div className="form-header">
        <h2>{isEdit ? "Edit Budget" : "New Budget"}</h2>
        <p>{isEdit ? "Update your budget details" : "Set a spending limit"}</p>
      </div>

      <form onSubmit={handleSubmit} className="budget-form">
        <div className="form-grid">
          <div className="form-group full-width">
            <label htmlFor="name" className="form-label">
              Budget Name
            </label>
            <input
              id="name"
              className="form-control"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Optional label, e.g. Monthly essentials"
            />
          </div>

          {isManager && (
            <div className="form-group full-width">
              <label htmlFor="user" className="form-label">
                User
              </label>
              <select
                id="user"
                className="form-select"
                name="user"
                value={form.user}
                onChange={handleChange}
              >
                <option value="">For Myself</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.role_display})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="period" className="form-label">
              Period *
            </label>
            <select
              id="period"
              className={`form-select ${errors.period ? 'is-invalid' : ''}`}
              name="period"
              value={form.period}
              onChange={handleChange}
              required
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {errors.period && (
              <div className="invalid-feedback">{errors.period}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="limit_amount" className="form-label">
              Limit Amount *
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                id="limit_amount"
                type="number"
                step="0.01"
                min="0.01"
                className={`form-control ${errors.limit_amount ? 'is-invalid' : ''}`}
                name="limit_amount"
                value={form.limit_amount}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
            {errors.limit_amount && (
              <div className="invalid-feedback">{errors.limit_amount}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="alert_threshold" className="form-label">
              Alert Threshold *
            </label>
            <div className="input-group">
              <input
                id="alert_threshold"
                type="number"
                step="1"
                min="1"
                max="100"
                className="form-control"
                name="alert_threshold"
                value={form.alert_threshold}
                onChange={handleChange}
                required
              />
              <span className="input-group-text">%</span>
            </div>
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
            {isSubmitting ? 'Saving...' : (isEdit ? 'Update Budget' : 'Create Budget')}
          </button>
        </div>
      </form>
    </div>
  );
}
