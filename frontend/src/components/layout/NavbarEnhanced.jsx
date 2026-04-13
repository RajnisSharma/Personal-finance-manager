import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import axios from "../../api/axiosConfig";
import { clearSession, getHomeRoute, getStoredRole, getStoredUser, isAdminRole, isAuthenticated, isManagerRole, getUserNavLinks, getRoleDisplayName } from "../../utils/session";
import ThemeToggle from "./ThemeToggle";
import "./Navbar.css";

export default function NavbarEnhanced() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const username = user?.username || localStorage.getItem("username");
  const role = getStoredRole();
  const authenticated = isAuthenticated();
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function handleNavToggle() {
    setIsNavCollapsed((current) => !current);
  }

  function handleNavLinkClick() {
    setIsNavCollapsed(true);
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      const refreshToken = localStorage.getItem("refresh");
      if (refreshToken) {
        await axios.post("/auth/logout/", { refresh: refreshToken });
      }
    } catch (error) {
      console.warn("Logout API call failed, clearing local session anyway.", error);
    } finally {
      clearSession();
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }
  }

  useEffect(() => {
    setIsNavCollapsed(true);
  }, [location.pathname]);

  const isActiveRoute = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const primaryLinks = getUserNavLinks(role).map(link => ({
    ...link,
    short: link.label.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
  }));

  return (
    <nav className="navbar navbar-expand-lg custom-navbar">
      <div className="container">
        <Link className="navbar-brand" to={authenticated ? getHomeRoute(role) : "/"} onClick={handleNavLinkClick}>
          <span className="brand-icon">PF</span>
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

        <div className={`collapse navbar-collapse ${!isNavCollapsed ? "show" : ""}`} id="navbarNav">
          <ul className="navbar-nav me-auto">
            {authenticated
              ? primaryLinks.map((item) => (
                <li className="nav-item" key={item.to}>
                  <Link
                    className={`nav-link ${isActiveRoute(item.to) ? "active" : ""}`}
                    to={item.to}
                    onClick={handleNavLinkClick}
                  >
                    <span className="nav-icon">{item.short}</span>
                    {item.label}
                  </Link>
                </li>
              ))
              : null}
          </ul>

          <div className="d-flex align-items-center navbar-controls">
            <ThemeToggle />
            <ul className="navbar-nav">
              {authenticated ? (
                <li className="nav-item dropdown">
                  <a
                    className="nav-link dropdown-toggle user-menu"
                    href="#"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <span className="user-avatar">U</span>
                    <span className="username">{username || "User"}</span>
                  </a>
                  <ul className="dropdown-menu">
                    <li>
                      <span className="dropdown-item-text user-info">
                        <small>Signed in as</small>
                        <strong>{username}</strong>
                        <small>{getRoleDisplayName(role)}</small>
                      </span>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    {isAdminRole(role) ? (
                      <>
                        <li>
                          <Link className="dropdown-item" to="/management/users" onClick={handleNavLinkClick}>
                            User Management
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item" to="/management/settings" onClick={handleNavLinkClick}>
                            System Settings
                          </Link>
                        </li>
                        <li><hr className="dropdown-divider" /></li>
                      </>
                    ) : null}
                    {isManagerRole(role) ? (
                      <>
                        <li>
                          <Link className="dropdown-item" to="/management/users" onClick={handleNavLinkClick}>
                            Managed Users
                          </Link>
                        </li>
                        <li><hr className="dropdown-divider" /></li>
                      </>
                    ) : null}
                    <li>
                      <Link className="dropdown-item" to="/settings" onClick={handleNavLinkClick}>
                        Settings
                      </Link>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button className="dropdown-item logout-item" onClick={handleLogout} disabled={isLoggingOut}>
                        {isLoggingOut ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            Signing out...
                          </>
                        ) : (
                          <>
                            <span className="logout-icon">OUT</span>
                            Sign Out
                          </>
                        )}
                      </button>
                    </li>
                  </ul>
                </li>
              ) : (
                <>
                  <li className="nav-item">
                    <Link
                      className={`nav-link ${location.pathname === "/login" ? "active" : ""}`}
                      to="/login"
                      onClick={handleNavLinkClick}
                    >
                      Sign In
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className={`nav-link ${location.pathname === "/register" ? "active" : ""}`}
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
