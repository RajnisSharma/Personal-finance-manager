import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AccountForm from "./components/accounts/AccountForm";
import AccountList from "./components/accounts/AccountList";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import Dashboard from "./components/Dashboard";
import InvestmentList from "./components/investments/InvestmentList";
import UserManagement from "./components/management/UserManagement";
import SystemSettings from "./components/management/SystemSettings";
import AuditLogs from "./components/management/AuditLogs";
import CategoriesManagement from "./components/management/CategoriesManagement";
import NotificationList from "./components/notifications/NotificationList";
import PaymentCenter from "./components/payments/PaymentCenter";
import TransactionList from "./components/transactions/TransactionList";
import TransactionForm from "./components/transactions/TransactionForm";
import BudgetList from "./components/budgets/BudgetList";
import BudgetForm from "./components/budgets/BudgetForm";
import GoalList from "./components/goals/GoalList";
import GoalForm from "./components/goals/GoalForm";
import Navbar from "./components/layout/NavbarEnhanced";
import Reports from "./components/Reports";
import SecuritySettings from "./components/settings/SecuritySettings";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { getHomeRoute, getStoredRole, isAuthenticated, ROLE_ADMINISTRATOR, ROLE_MANAGER, ROLE_USER } from "./utils/session";
import "./styles/index.css";

function PrivateRoute({ children, allowedRoles = null }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(getStoredRole())) {
    return <Navigate to={getHomeRoute()} replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const isAuth = isAuthenticated();
  return !isAuth ? children : <Navigate to={getHomeRoute()} replace />;
}

function AppContent() {
  const location = useLocation();

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={
              isAuthenticated() ?
                <Navigate to={getHomeRoute()} replace /> :
                <Navigate to="/login" replace />
            } />
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            } />
            <Route path="/reset-password" element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            } />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/management/users" element={
              <PrivateRoute allowedRoles={[ROLE_ADMINISTRATOR]}>
                <UserManagement />
              </PrivateRoute>
            } />
            <Route path="/management/settings" element={
              <PrivateRoute allowedRoles={[ROLE_ADMINISTRATOR]}>
                <SystemSettings />
              </PrivateRoute>
            } />
            <Route path="/management/audit-logs" element={
              <PrivateRoute allowedRoles={[ROLE_ADMINISTRATOR]}>
                <AuditLogs />
              </PrivateRoute>
            } />
            <Route path="/management/categories" element={
              <PrivateRoute allowedRoles={[ROLE_ADMINISTRATOR]}>
                <CategoriesManagement />
              </PrivateRoute>
            } />
            <Route path="/reports" element={
              <PrivateRoute>
                <Reports />
              </PrivateRoute>
            } />
            <Route path="/accounts" element={
              <PrivateRoute>
                <AccountList />
              </PrivateRoute>
            } />
            <Route path="/accounts/new" element={
              <PrivateRoute>
                <AccountForm />
              </PrivateRoute>
            } />
            <Route path="/accounts/:id/edit" element={
              <PrivateRoute>
                <AccountForm />
              </PrivateRoute>
            } />
            <Route path="/transactions" element={
              <PrivateRoute>
                <TransactionList />
              </PrivateRoute>
            } />
            <Route path="/investments" element={
              <PrivateRoute>
                <InvestmentList />
              </PrivateRoute>
            } />
            <Route path="/payments" element={
              <PrivateRoute>
                <PaymentCenter />
              </PrivateRoute>
            } />
            <Route path="/notifications" element={
              <PrivateRoute>
                <NotificationList />
              </PrivateRoute>
            } />
            <Route path="/settings" element={
              <PrivateRoute>
                <SecuritySettings />
              </PrivateRoute>
            } />
            <Route path="/transactions/new" element={
              <PrivateRoute>
                <TransactionForm />
              </PrivateRoute>
            } />
            <Route path="/transactions/:id/edit" element={
              <PrivateRoute>
                <TransactionForm />
              </PrivateRoute>
            } />
            <Route path="/budgets" element={
              <PrivateRoute>
                <BudgetList />
              </PrivateRoute>
            } />
            <Route path="/budgets/new" element={
              <PrivateRoute>
                <BudgetForm />
              </PrivateRoute>
            } />
            <Route path="/budgets/:id/edit" element={
              <PrivateRoute>
                <BudgetForm />
              </PrivateRoute>
            } />
            <Route path="/goals" element={
              <PrivateRoute>
                <GoalList />
              </PrivateRoute>
            } />
            <Route path="/goals/new" element={
              <PrivateRoute>
                <GoalForm />
              </PrivateRoute>
            } />
            <Route path="/goals/:id/edit" element={
              <PrivateRoute>
                <GoalForm />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
