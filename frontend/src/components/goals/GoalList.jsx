import React, { useEffect, useState } from "react";
import axios from "../../api/axiosConfig";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import "./GoalList.css";

export default function GoalList() {
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get("/goals/");
      setGoals(response.data.results || response.data);
    } catch (err) {
      console.error("Failed to load goals:", err);
      setError("Failed to load goals");
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" goal?`)) {
      return;
    }

    try {
      await axios.delete(`/goals/${id}/`);
      loadGoals();
    } catch (err) {
      alert("Failed to delete goal");
    }
  };

  if (isLoading) {
    return (
      <div className="goal-list-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading goals...</p>
      </div>
    );
  }

  return (
    <div className="goal-list-container">
      <div className="list-header">
        <div className="header-content">
          <h2>Goals</h2>
          <p>Track your financial objectives</p>
        </div>
        <Link to="/goals/new" className="btn btn-primary">
          + New Goal
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button
            className="btn btn-sm btn-outline-danger ms-2"
            onClick={loadGoals}
          >
            Retry
          </button>
        </div>
      )}

      <div className="goals-grid">
        {goals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No goals found</h3>
            <p>Set your first financial goal to start saving</p>
            <Link to="/goals/new" className="btn btn-primary">
              Create Goal
            </Link>
          </div>
        ) : (
          goals.map(goal => {
            const progress = Number(goal.progress_percentage || 0);
            return (
              <div key={goal.id} className="goal-card">
                <div className="goal-header">
                  <div>
                    <p className="goal-label">{goal.goal_type}</p>
                    <h3>{goal.name}</h3>
                  </div>
                  <div className="goal-actions">
                    <Link
                      to={`/goals/${goal.id}/edit`}
                      className="btn btn-sm btn-outline-primary me-1"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(goal.id, goal.name)}
                      className="btn btn-sm btn-outline-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="goal-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    ({progress.toFixed(1)}%)
                  </div>
                </div>
                <div className="goal-due-date">
                  Due: {new Date(goal.due_date).toLocaleDateString()}
                </div>
                <div className="goal-extra">
                  <span>{formatCurrency(goal.remaining_amount)} remaining</span>
                  <span>
                    {goal.estimated_completion_date
                      ? `Forecast ${new Date(goal.estimated_completion_date).toLocaleDateString()}`
                      : "Forecast unavailable"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
