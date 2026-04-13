import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import axios from "../../api/axiosConfig";
import "./Auth.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    passwordConfirm: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus({
        type: "error",
        message: "Invalid or missing reset token. Please request a new password reset link.",
      });
    }
  }, [token]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (formData.password !== formData.passwordConfirm) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    if (formData.password.length < 6) {
      setStatus({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await axios.post("/auth/password-reset/confirm/", {
        token,
        password: formData.password,
        password_confirm: formData.passwordConfirm,
      });

      setIsSuccess(true);
      setStatus({
        type: "success",
        message: "Your password has been reset successfully. You can now sign in with your new password.",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.detail || "Failed to reset password. The link may have expired.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <span className="material-icons" style={{ fontSize: "48px", color: "var(--danger)" }}>
                error_outline
              </span>
              <h1 className="auth-title">Invalid Link</h1>
              <p className="auth-subtitle">
                This password reset link is invalid or has expired.
              </p>
            </div>

            <div className="alert alert-error">
              <span className="material-icons">error</span>
              <span>{status.message}</span>
            </div>

            <div className="auth-footer">
              <Link to="/forgot-password" className="btn btn-primary btn-full">
                <span className="material-icons">refresh</span>
                Request New Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Set New Password</h1>
            <p className="auth-subtitle">Create a new password for your account.</p>
          </div>

          {status.message && (
            <div className={`alert ${status.type === "success" ? "alert-success" : "alert-error"}`}>
              {status.type === "success" ? (
                <span className="material-icons">check_circle</span>
              ) : (
                <span className="material-icons">error</span>
              )}
              <span>{status.message}</span>
            </div>
          )}

          {!isSuccess && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  New Password
                </label>
                <div className="input-wrapper">
                  <span className="material-icons input-icon">lock</span>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="form-input"
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    disabled={isLoading}
                  />
                </div>
                <small className="form-hint">Must be at least 6 characters</small>
              </div>

              <div className="form-group">
                <label htmlFor="passwordConfirm" className="form-label">
                  Confirm Password
                </label>
                <div className="input-wrapper">
                  <span className="material-icons input-icon">lock_outline</span>
                  <input
                    type="password"
                    id="passwordConfirm"
                    name="passwordConfirm"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={formData.passwordConfirm}
                    onChange={handleChange}
                    required
                    minLength={6}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isLoading || !formData.password || !formData.passwordConfirm}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Resetting...
                  </>
                ) : (
                  <>
                    <span className="material-icons">lock_reset</span>
                    Reset Password
                  </>
                )}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <p>
              <Link to="/login" className="auth-link">
                <span className="material-icons" style={{ fontSize: "16px", verticalAlign: "middle" }}>
                  arrow_back
                </span>{" "}
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
