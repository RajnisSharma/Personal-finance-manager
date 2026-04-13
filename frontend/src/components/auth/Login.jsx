import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../../api/axiosConfig";
import { getHomeRoute, persistSession } from "../../utils/session";
import "./Auth.css";

const INITIAL_FORM = {
  username: "",
  password: "",
  otp_code: "",
  backup_code: "",
};

export default function Login() {
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
    if (!form.username.trim()) validationErrors.username = "Username is required";
    if (!form.password) validationErrors.password = "Password is required";
    return validationErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await axios.post("/auth/login/", form);
      persistSession(response.data);
      navigate(getHomeRoute(response.data.user?.role), { replace: true });
    } catch (error) {
      console.error("Login error:", error);
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
        autoComplete={id === "password" ? "current-password" : id}
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
            <h2>Welcome Back</h2>
            <p>Sign in to manage your finances securely</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form">
            {renderField("username", "Username", "text", "Enter your username")}
            {renderField("password", "Password", "password", "Enter your password")}

            <div className="form-options">
              <Link to="/forgot-password" className="forgot-password-link">
                Forgot password?
              </Link>
            </div>

            <div className="auth-options">
              {renderField("otp_code", "One-Time Code", "text", "2FA code if enabled")}
              {renderField("backup_code", "Backup Code", "text", "Use if no OTP")}
            </div>

            {renderError("non_field_errors")}
            {renderError("detail")}

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <footer className="auth-footer">
            <p>
              Don&apos;t have an account? <Link to="/register" className="auth-link">Sign up</Link>
            </p>
            <p className="form-text">
              Manager and administrator accounts are created by system administrators.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
