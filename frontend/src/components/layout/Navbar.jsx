import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "../../api/axiosConfig";
import ThemeToggle from "./ThemeToggle";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username");
  const isAuthenticated = Boolean(localStorage.getItem("access"));
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userRoleDisplay, setUserRoleDisplay] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserProfile();
    }
  }, [isAuthenticated]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get("/auth/profile/");
      setUserRole(response.data.role);
      setUserRoleDisplay(response.data.role_display);
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  const handleNavToggle = () => {
    setIsNavCollapsed((current) => !current);
  };

  const handleNavLinkClick = () => {
    setIsNavCollapsed(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      const refreshToken = localStorage.getItem("refresh");
      if (refreshToken) {
        await axios.post("/auth/logout/", { refresh: refreshToken });
      }
    } catch (error) {
      console.warn("Logout API call failed, clearing local session anyway.", error);
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("username");
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    setIsNavCollapsed(true);
  }, [location.pathname]);

  const isActiveRoute = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <nav className="navbar navbar-expand-lg custom-navbar">
      <div className="container">
        <Link 
          className="navbar-brand" 
          to={isAuthenticated ? "/dashboard" : "/"}
          onClick={() => setIsNavCollapsed(true)}
        >
          <span className="brand-icon">💰</span>
          PFM
        </Link>
        
        <button
          className="navbar-toggler"
          type="button"
          onClick={handleNavToggle}
          aria-controls="navbarNav"
          aria-expanded={!isNavCollapsed}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className={`collapse navbar-collapse ${!isNavCollapsed ? 'show' : ''}`} id="navbarNav">
          <ul className="navbar-nav me-auto">
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActiveRoute('/dashboard') ? 'active' : ''}`}
                    to="/dashboard"
                    onClick={handleNavLinkClick}
                  >
                    <span className="nav-icon">📊</span>
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${isActiveRoute('/accounts') ? 'active' : ''}`}
                    to="/accounts"
                    onClick={handleNavLinkClick}
                  >
                    <span className="nav-icon">AC</span>
                    Accounts
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActiveRoute('/transactions') ? 'active' : ''}`}
                    to="/transactions"
                    onClick={handleNavLinkClick}
                  >
                    <span className="nav-icon">💳</span>
                    Transactions
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActiveRoute('/budgets') ? 'active' : ''}`}
                    to="/budgets"
                    onClick={handleNavLinkClick}
                  >
                    <span className="nav-icon">📈</span>
                    Budgets
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActiveRoute('/goals') ? 'active' : ''}`}
                    to="/goals"
                    onClick={handleNavLinkClick}
                  >
                    <span className="nav-icon">🎯</span>
                    Goals
                  </Link>
                </li>
                {(userRole === "administrator" || userRole === "manager") && (
                  <li className="nav-item">
                    <Link 
                      className={`nav-link ${isActiveRoute('/management/users') ? 'active' : ''}`}
                      to="/management/users"
                      onClick={handleNavLinkClick}
                    >
                      <span className="nav-icon">👥</span>
                      User Management
                    </Link>
                  </li>
                )}
                {userRole === "administrator" && (
                  <li className="nav-item">
                    <Link 
                      className={`nav-link ${isActiveRoute('/management/settings') ? 'active' : ''}`}
                      to="/management/settings"
                      onClick={handleNavLinkClick}
                    >
                      <span className="nav-icon">⚙️</span>
                      System Settings
                    </Link>
                  </li>
                )}
              </>
            )}
          </ul>
          
          <div className="d-flex align-items-center navbar-controls">
            <ThemeToggle />
            <ul className="navbar-nav">
              {isAuthenticated ? (
                <>
                  <li className="nav-item dropdown">
                    <a
                      className="nav-link dropdown-toggle user-menu"
                      href="#"
                      role="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <span className="user-avatar">👤</span>
                      <span className="username">{username || "User"}</span>
                    </a>
                    <ul className="dropdown-menu">
                      <li>
                        <span className="dropdown-item-text user-info">
                          <small>Signed in as</small>
                          <strong>{username}</strong>
                          {userRoleDisplay && (
                            <div className="user-role">{userRoleDisplay}</div>
                          )}
                        </span>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <button 
                          className="dropdown-item logout-item" 
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                        >
                          {isLoggingOut ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status" />
                              Signing out...
                            </>
                          ) : (
                            <>
                              <span className="logout-icon">🚪</span>
                              Sign Out
                            </>
                          )}
                        </button>
                      </li>
                    </ul>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <Link 
                      className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                      to="/login"
                      onClick={handleNavLinkClick}
                    >
                      Sign In
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link 
                      className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}
                      to="/register"
                      onClick={handleNavLinkClick}
                    >
                      Sign Up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
