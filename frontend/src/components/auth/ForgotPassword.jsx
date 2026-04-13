import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "../../api/axiosConfig";
import "./Auth.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await axios.post("/auth/password-reset/request/", { email: email.trim() });
      setStatus({
        type: "success",
        message: "If an account exists with this email, you will receive a password reset link shortly.",
      });
      setEmail("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.detail || "Failed to send reset request. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">
              Enter your email address and we'll send you a link to reset your password.
            </p>
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

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <div className="input-wrapper">
                <span className="material-icons input-icon">email</span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Sending...
                </>
              ) : (
                <>
                  <span className="material-icons">send</span>
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Remember your password?{" "}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
