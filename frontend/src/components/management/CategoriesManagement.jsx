import React, { useEffect, useState } from "react";
import axios from "../../api/axiosConfig";
import "../common/FeatureWorkspace.css";

const CATEGORY_TYPES = [
  { value: "income", label: "Income", color: "success" },
  { value: "expense", label: "Expense", color: "danger" },
  { value: "transfer", label: "Transfer", color: "primary" },
  { value: "investment", label: "Investment", color: "info" },
];

const DEFAULT_ICONS = [
  "shopping_cart",
  "restaurant",
  "directions_car",
  "home",
  "medical_services",
  "school",
  "sports_esports",
  "flight",
  "attach_money",
  "credit_card",
  "account_balance",
  "savings",
  "trending_up",
  "receipt",
  "local_grocery_store",
];

export default function CategoriesManagement() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [createForm, setCreateForm] = useState({
    name: "",
    type: "expense",
    icon: "shopping_cart",
    color: "#0f766e",
    is_global: true,
    description: "",
  });
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "expense",
    icon: "shopping_cart",
    color: "#0f766e",
    is_global: true,
    description: "",
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.get("/categories/");
      setCategories(response.data);
    } catch (err) {
      console.error("Failed to load categories", err);
      setError("Failed to load categories. Please try again.");
      
      setCategories([
        { id: 1, name: "Groceries", type: "expense", icon: "local_grocery_store", color: "#0f766e", is_global: true, usage_count: 156 },
        { id: 2, name: "Salary", type: "income", icon: "attach_money", color: "#1d4ed8", is_global: true, usage_count: 24 },
        { id: 3, name: "Dining Out", type: "expense", icon: "restaurant", color: "#b45309", is_global: true, usage_count: 89 },
        { id: 4, name: "Transportation", type: "expense", icon: "directions_car", color: "#6d28d9", is_global: true, usage_count: 67 },
        { id: 5, name: "Utilities", type: "expense", icon: "home", color: "#be123c", is_global: true, usage_count: 45 },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleInputChange(setter, event) {
    const { name, value, type, checked } = event.target;
    setter((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.post("/categories/", createForm);
      setCategories((current) => [...current, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCreateForm({
        name: "",
        type: "expense",
        icon: "shopping_cart",
        color: "#0f766e",
        is_global: true,
        description: "",
      });
      setSuccess("Category created successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to create category", err);
      setError("Failed to create category. Please check the form and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function startEditing(category) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      type: category.type,
      icon: category.icon || "shopping_cart",
      color: category.color || "#0f766e",
      is_global: category.is_global ?? true,
      description: category.description || "",
    });
    setSuccess("");
    setError("");
  }

  async function handleSaveEdit(categoryId) {
    try {
      setIsLoading(true);
      setError("");
      const response = await axios.patch(`/categories/${categoryId}/`, editForm);
      setCategories((current) =>
        current.map((item) => (item.id === categoryId ? response.data : item))
      );
      setEditingId(null);
      setSuccess("Category updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to update category", err);
      setError("Failed to update category.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteCategory(categoryId, categoryName) {
    const confirmed = window.confirm(`Delete category "${categoryName}"? This may affect existing transactions.`);
    if (!confirmed) return;

    try {
      setIsLoading(true);
      setError("");
      await axios.delete(`/categories/${categoryId}/`);
      setCategories((current) => current.filter((item) => item.id !== categoryId));
      setSuccess(`Category "${categoryName}" deleted.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to delete category", err);
      setError("Failed to delete category. It may be in use by existing transactions.");
    } finally {
      setIsLoading(false);
    }
  }

  const groupedCategories = categories.reduce((acc, category) => {
    const type = category.type || "expense";
    if (!acc[type]) acc[type] = [];
    acc[type].push(category);
    return acc;
  }, {});

  if (isLoading && categories.length === 0) {
    return (
      <section className="feature-page">
        <div className="feature-card">
          <div className="spinner-border text-primary" role="status" />
          <p className="meta-copy">Loading categories...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">System Configuration</p>
          <h1>Category Management</h1>
          <p className="meta-copy">
            Create and manage global transaction categories available to all users across the platform.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <form className="feature-card" onSubmit={handleCreateCategory}>
        <div className="list-title">
          <p className="stat-label">Create Category</p>
          <h2>Add New Global Category</h2>
        </div>

        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Name *</span>
            <input
              className="form-control"
              name="name"
              value={createForm.name}
              onChange={(e) => handleInputChange(setCreateForm, e)}
              required
              placeholder="e.g., Healthcare"
            />
          </label>

          <label className="form-group">
            <span className="form-label">Type *</span>
            <select
              className="form-select"
              name="type"
              value={createForm.type}
              onChange={(e) => handleInputChange(setCreateForm, e)}
              required
            >
              {CATEGORY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="form-label">Icon</span>
            <select
              className="form-select"
              name="icon"
              value={createForm.icon}
              onChange={(e) => handleInputChange(setCreateForm, e)}
            >
              {DEFAULT_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="form-label">Color</span>
            <div className="color-input-wrapper">
              <input
                className="form-control"
                type="color"
                name="color"
                value={createForm.color}
                onChange={(e) => handleInputChange(setCreateForm, e)}
                style={{ padding: "0.25rem", height: "38px" }}
              />
            </div>
          </label>

          <label className="form-group full-width">
            <span className="form-label">Description</span>
            <input
              className="form-control"
              name="description"
              value={createForm.description}
              onChange={(e) => handleInputChange(setCreateForm, e)}
              placeholder="Optional description of this category"
            />
          </label>

          <label className="form-group toggle-row">
            <input
              type="checkbox"
              name="is_global"
              checked={createForm.is_global}
              onChange={(e) => handleInputChange(setCreateForm, e)}
            />
            <span>Available to all users (Global)</span>
          </label>
        </div>

        <div className="form-actions">
          <p className="meta-copy">
            Global categories are visible to all users when creating transactions.
          </p>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Category"}
          </button>
        </div>
      </form>

      <div className="dual-grid">
        {CATEGORY_TYPES.map((type) => (
          <section className="feature-card" key={type.value}>
            <div className="list-title">
              <p className="stat-label">{type.label} Categories</p>
              <h2>
                {groupedCategories[type.value]?.length || 0} {type.label.toLowerCase()} categories
              </h2>
            </div>

            <div className="feature-list">
              {(groupedCategories[type.value] || []).length > 0 ? (
                groupedCategories[type.value].map((category) => {
                  const isEditing = editingId === category.id;
                  return (
                    <article className="feature-list-item" key={category.id}>
                      <div className="list-head">
                        <div className="category-info">
                          <span
                            className="category-color"
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: category.color,
                              marginRight: "8px",
                            }}
                          />
                          <strong>{category.name}</strong>
                        </div>
                        <span className="badge-soft secondary">
                          {category.usage_count || 0} uses
                        </span>
                      </div>

                      <div className="summary-row">
                        <span className="meta-copy">
                          Icon: {category.icon?.replace(/_/g, " ")}
                        </span>
                        <span className="meta-copy">
                          {category.is_global ? "Global" : "Private"}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="surface-block">
                          <div className="form-grid">
                            <label className="form-group">
                              <span className="form-label">Name</span>
                              <input
                                className="form-control"
                                name="name"
                                value={editForm.name}
                                onChange={(e) => handleInputChange(setEditForm, e)}
                              />
                            </label>
                            <label className="form-group">
                              <span className="form-label">Type</span>
                              <select
                                className="form-select"
                                name="type"
                                value={editForm.type}
                                onChange={(e) => handleInputChange(setEditForm, e)}
                              >
                                {CATEGORY_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-group">
                              <span className="form-label">Color</span>
                              <input
                                className="form-control"
                                type="color"
                                name="color"
                                value={editForm.color}
                                onChange={(e) => handleInputChange(setEditForm, e)}
                                style={{ padding: "0.25rem", height: "38px" }}
                              />
                            </label>
                          </div>
                          <div className="form-actions">
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSaveEdit(category.id)}
                              disabled={isLoading}
                            >
                              {isLoading ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => startEditing(category)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            disabled={isLoading}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="empty-panel">
                  <strong>No {type.label.toLowerCase()} categories</strong>
                  <p className="meta-copy">
                    Create categories above to organize user transactions.
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
