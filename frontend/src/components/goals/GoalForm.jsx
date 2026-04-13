import React, { useState, useEffect } from "react";
import axios from "../../api/axiosConfig";
import { useNavigate, useParams } from "react-router-dom";
import { getStoredRole, ROLE_MANAGER } from "../../utils/session";
import './GoalForm.css';

export default function GoalForm() {
  const [form, setForm] = useState({
    name: "",
    goal_type: "savings",
    linked_account: "",
    target_amount: "",
    current_amount: "",
    monthly_contribution_target: "",
    due_date: "",
    user: "", // for managers
  });
  const [accounts, setAccounts] = useState([]);
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
    loadAccounts();
    if (isManager) {
      loadUsers();
    }
    if (isEdit) {
      loadGoal();
    }
  }, [isEdit, params.id, isManager]);

  const loadAccounts = async () => {
    try {
      const response = await axios.get("/accounts/");
      setAccounts(response.data.results || response.data);
    } catch (err) {
      console.error("Failed to load accounts:", err);
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

  const loadGoal = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/goals/${params.id}/`);
      const goal = response.data;
      setForm({
        name: goal.name,
        goal_type: goal.goal_type || "savings",
        linked_account: goal.linked_account || "",
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        monthly_contribution_target: goal.monthly_contribution_target || "",
        due_date: goal.due_date
      });
    } catch (err) {
      setErrors({ general: "Failed to load goal" });
      navigate("/goals");
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.name?.trim()) {
      newErrors.name = "Goal name is required";
    }

    if (!form.target_amount || parseFloat(form.target_amount) <= 0) {
      newErrors.target_amount = "Valid target amount is required";
    }

    if (parseFloat(form.current_amount) < 0) {
      newErrors.current_amount = "Current amount cannot be negative";
    }

    if (!form.due_date) {
      newErrors.due_date = "Due date is required";
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
        linked_account: form.linked_account || null,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        monthly_contribution_target: parseFloat(form.monthly_contribution_target) || 0
      };

      if (isManager && form.user) {
        submitData.user = form.user;
      }

      if (isEdit) {
        await axios.patch(`/goals/${params.id}/`, submitData);
      } else {
        await axios.post("/goals/", submitData);
      }

      navigate("/goals");
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        if (typeof errorData === 'string') {
          setErrors({ general: errorData });
        } else {
          setErrors(errorData);
        }
      } else {
        setErrors({ general: "Failed to save goal" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/goals");
  };

  if (isLoading) {
    return (
      <div className="goal-form-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading goal...</p>
      </div>
    );
  }

  return (
    <div className="goal-form-container">
      <div className="form-header">
        <h2>{isEdit ? "Edit Goal" : "New Goal"}</h2>
        <p>{isEdit ? "Update your goal details" : "Set a financial target"}</p>
      </div>

      <form onSubmit={handleSubmit} className="goal-form">
        <div className="form-grid">
          <div className="form-group full-width">
            <label htmlFor="name" className="form-label">
              Goal Name *
            </label>
            <input
              id="name"
              type="text"
              className={`form-control ${errors.name ? 'is-invalid' : ''}`}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Vacation Fund"
              required
            />
            {errors.name && (
              <div className="invalid-feedback">{errors.name}</div>
            )}
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
            <label htmlFor="goal_type" className="form-label">
              Goal Type *
            </label>
            <select
              id="goal_type"
              className="form-select"
              name="goal_type"
              value={form.goal_type}
              onChange={handleChange}
            >
              <option value="savings">Savings</option>
              <option value="debt">Debt payoff</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="linked_account" className="form-label">
              Linked Account
            </label>
            <select
              id="linked_account"
              className="form-select"
              name="linked_account"
              value={form.linked_account}
              onChange={handleChange}
            >
              <option value="">None</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="target_amount" className="form-label">
              Target Amount *
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                id="target_amount"
                type="number"
                step="0.01"
                min="0.01"
                className={`form-control ${errors.target_amount ? 'is-invalid' : ''}`}
                name="target_amount"
                value={form.target_amount}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
            {errors.target_amount && (
              <div className="invalid-feedback">{errors.target_amount}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="current_amount" className="form-label">
              Current Amount
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                id="current_amount"
                type="number"
                step="0.01"
                min="0"
                className={`form-control ${errors.current_amount ? 'is-invalid' : ''}`}
                name="current_amount"
                value={form.current_amount}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            {errors.current_amount && (
              <div className="invalid-feedback">{errors.current_amount}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="monthly_contribution_target" className="form-label">
              Monthly Contribution Target
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                id="monthly_contribution_target"
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                name="monthly_contribution_target"
                value={form.monthly_contribution_target}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="due_date" className="form-label">
              Due Date *
            </label>
            <input
              id="due_date"
              type="date"
              className={`form-control ${errors.due_date ? 'is-invalid' : ''}`}
              name="due_date"
              value={form.due_date}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              required
            />
            {errors.due_date && (
              <div className="invalid-feedback">{errors.due_date}</div>
            )}
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
            {isSubmitting ? 'Saving...' : (isEdit ? 'Update Goal' : 'Create Goal')}
          </button>
        </div>
      </form>
    </div>
  );
}
