import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../../api/axiosConfig";
import { getHomeRoute, persistSession } from "../../utils/session";
import "./Auth.css";

const INITIAL_FORM = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  base_currency: "USD",
};

const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "GBP", label: "GBP - British Pound" },
];

export default function Register() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const validationErrors = {};

    if (!form.username.trim()) {
      validationErrors.username = "Username is required";
    } else if (form.username.length < 3) {
      validationErrors.username = "Username must be at least 3 characters";
    }

    if (!form.email.trim()) {
      validationErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      validationErrors.email = "Email is invalid";
    }

    if (!form.password) {
      validationErrors.password = "Password is required";
    } else if (form.password.length < 6) {
      validationErrors.password = "Password must be at least 6 characters";
    }

    if (form.password !== form.confirmPassword) {
      validationErrors.confirmPassword = "Passwords do not match";
    }

    return validationErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const { confirmPassword, ...submitData } = form;
      const response = await axios.post("/auth/register/", submitData);
      persistSession(response.data);
      navigate(getHomeRoute(response.data.role || response.data.user?.role), { replace: true });
    } catch (error) {
      console.error("Registration error:", error);
      setErrors(
        error.response?.data || { non_field_errors: "Network error. Please try again." }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderField = (id, label, type = "text", placeholder) => (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        className={`form-control ${errors[id] ? "is-invalid" : ""}`}
        value={form[id]}
        onChange={(e) => updateField(id, e.target.value)}
        disabled={isLoading}
        placeholder={placeholder}
        autoComplete={id === "password" ? "new-password" : id}
      />
      {errors[id] && <div className="invalid-feedback">{errors[id]}</div>}
    </div>
  );

  const renderError = (key) => {
    const error = errors[key];
    if (!error) return null;
    return (
      <div className="alert alert-danger">
        {Array.isArray(error) ? error.join(", ") : error}
      </div>
    );
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <header className="auth-header">
            <h2>Create Account</h2>
            <p>Start your personal finance journey today</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form">
            {renderField("username", "Username", "text", "Choose a username (min 3 chars)")}
            {renderField("email", "Email", "email", "Enter your email address")}

            <div className="auth-options">
              {renderField("password", "Password", "password", "Create a password (min 6 chars)")}
              {renderField("confirmPassword", "Confirm Password", "password", "Confirm your password")}
            </div>

            <div className="form-group">
              <label htmlFor="base_currency" className="form-label">Base Currency</label>
              <select
                id="base_currency"
                name="base_currency"
                className="form-select"
                value={form.base_currency}
                onChange={(e) => updateField("base_currency", e.target.value)}
                disabled={isLoading}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {renderError("non_field_errors")}

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <footer className="auth-footer">
            <p>
              Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
            </p>
            <p className="form-text">
              Administrator and manager accounts are created through the management workspace.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
