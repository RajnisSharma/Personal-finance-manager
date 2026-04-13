import React, { useEffect, useState } from "react";

import axios from "../../api/axiosConfig";
import { formatCurrency } from "../../utils/formatters";
import "../common/FeatureWorkspace.css";

const paymentTemplate = {
  account: "",
  amount: "",
  currency: "USD",
  payee_name: "",
  payee_reference: "",
  iban: "",
  scheduled_for: "",
};

const billTemplate = {
  account: "",
  file_name: "",
  raw_text: "",
};

export default function PaymentCenter() {
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [billScans, setBillScans] = useState([]);
  const [paymentForm, setPaymentForm] = useState(paymentTemplate);
  const [billForm, setBillForm] = useState(billTemplate);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");
      const [accountsResponse, paymentsResponse, billScansResponse] = await Promise.all([
        axios.get("/accounts/"),
        axios.get("/payments/"),
        axios.get("/bill-scans/"),
      ]);
      setAccounts(accountsResponse.data.results || accountsResponse.data);
      setPayments(paymentsResponse.data.results || paymentsResponse.data);
      setBillScans(billScansResponse.data.results || billScansResponse.data);
    } catch (err) {
      console.error("Failed to load payment center", err);
      setError("Failed to load payment center data.");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePaymentChange(event) {
    const { name, value } = event.target;
    setPaymentForm((current) => ({ ...current, [name]: value }));
  }

  function handleBillChange(event) {
    const { name, value } = event.target;
    setBillForm((current) => ({ ...current, [name]: value }));
  }

  async function createPayment(event) {
    event.preventDefault();
    try {
      setIsSubmittingPayment(true);
      setError("");
      await axios.post("/payments/", {
        ...paymentForm,
        account: Number(paymentForm.account),
        amount: Number(paymentForm.amount),
        currency: paymentForm.currency.toUpperCase(),
        scheduled_for: paymentForm.scheduled_for || null,
      });
      setPaymentForm(paymentTemplate);
      setSuccess("Payment request created.");
      await loadData();
    } catch (err) {
      console.error("Failed to create payment", err);
      setError("Failed to create payment request.");
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  async function submitPayment(paymentId) {
    try {
      await axios.post(`/payments/${paymentId}/submit/`);
      setSuccess("Payment submitted.");
      await loadData();
    } catch (err) {
      setError("Failed to submit payment.");
    }
  }

  async function createBillScan(event) {
    event.preventDefault();
    try {
      setIsSubmittingBill(true);
      setError("");
      await axios.post("/bill-scans/", {
        ...billForm,
        account: billForm.account ? Number(billForm.account) : null,
      });
      setBillForm(billTemplate);
      setSuccess("Bill scan processed.");
      await loadData();
    } catch (err) {
      console.error("Failed to create bill scan", err);
      setError("Failed to process bill scan.");
    } finally {
      setIsSubmittingBill(false);
    }
  }

  const completedPayments = payments.filter((item) => item.status === "completed").length;
  const scheduledPayments = payments.filter((item) => ["pending", "initiated"].includes(item.status)).length;

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <p className="stat-label">Payments</p>
          <h1>Payment requests and bill intake</h1>
          <p className="meta-copy">
            Queue outgoing payments, simulate submission, and turn bill text into structured finance data.
          </p>
        </div>
        <div className="feature-actions">
          <button type="button" className="btn btn-outline-primary" onClick={loadData}>
            Refresh
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Payment requests</span>
          <strong className="stat-value">{payments.length}</strong>
          <p className="stat-copy">Created through the sandbox payment workflow</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Submitted or scheduled</span>
          <strong className="stat-value">{scheduledPayments}</strong>
          <p className="stat-copy">Initiated or waiting for execution date</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Completed</span>
          <strong className="stat-value">{completedPayments}</strong>
          <p className="stat-copy">Requests marked complete in the current sandbox flow</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">Bill scans</span>
          <strong className="stat-value">{billScans.length}</strong>
          <p className="stat-copy">OCR-style extraction records</p>
        </article>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="dual-grid">
        <form className="feature-card" onSubmit={createPayment}>
          <div className="list-title">
            <p className="stat-label">New payment</p>
            <h2>Create payment request</h2>
            <p className="meta-copy">Use a linked account and capture the payee details you need.</p>
          </div>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Funding account</span>
              <select className="form-select" name="account" value={paymentForm.account} onChange={handlePaymentChange} required>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">Amount</span>
              <input
                className="form-control"
                type="number"
                step="0.01"
                name="amount"
                value={paymentForm.amount}
                onChange={handlePaymentChange}
                required
              />
            </label>

            <label className="form-group">
              <span className="form-label">Currency</span>
              <input
                className="form-control"
                name="currency"
                value={paymentForm.currency}
                onChange={handlePaymentChange}
                maxLength={3}
                required
              />
            </label>

            <label className="form-group">
              <span className="form-label">Payee</span>
              <input className="form-control" name="payee_name" value={paymentForm.payee_name} onChange={handlePaymentChange} required />
            </label>

            <label className="form-group">
              <span className="form-label">Reference</span>
              <input className="form-control" name="payee_reference" value={paymentForm.payee_reference} onChange={handlePaymentChange} />
            </label>

            <label className="form-group">
              <span className="form-label">IBAN or account reference</span>
              <input className="form-control" name="iban" value={paymentForm.iban} onChange={handlePaymentChange} />
            </label>

            <label className="form-group">
              <span className="form-label">Schedule date</span>
              <input className="form-control" type="date" name="scheduled_for" value={paymentForm.scheduled_for} onChange={handlePaymentChange} />
            </label>
          </div>

          <div className="form-actions">
            <p className="meta-copy">Submitting later will flip the request into pending or completed status.</p>
            <button type="submit" className="btn btn-primary" disabled={isSubmittingPayment}>
              {isSubmittingPayment ? "Creating..." : "Create payment"}
            </button>
          </div>
        </form>

        <form className="feature-card" onSubmit={createBillScan}>
          <div className="list-title">
            <p className="stat-label">Bill scan</p>
            <h2>Parse invoice or bill text</h2>
            <p className="meta-copy">Paste OCR text or a short receipt sample to extract merchant, amount, and date.</p>
          </div>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Account</span>
              <select className="form-select" name="account" value={billForm.account} onChange={handleBillChange}>
                <option value="">No account selected</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">File name</span>
              <input className="form-control" name="file_name" value={billForm.file_name} onChange={handleBillChange} required />
            </label>

            <label className="form-group full-width">
              <span className="form-label">Raw text</span>
              <textarea
                className="form-control"
                name="raw_text"
                rows="6"
                value={billForm.raw_text}
                onChange={handleBillChange}
                placeholder="Example: Water_Bill_2026-04-01 124.50 Due now"
              />
            </label>
          </div>

          <div className="form-actions">
            <p className="meta-copy">The current parser is rule-based and designed for demo or seed workflows.</p>
            <button type="submit" className="btn btn-primary" disabled={isSubmittingBill}>
              {isSubmittingBill ? "Processing..." : "Process bill"}
            </button>
          </div>
        </form>
      </div>

      <div className="dual-grid">
        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Outgoing</p>
            <h2>Payment queue</h2>
          </div>

          {isLoading ? (
            <div className="surface-stack">
              <div className="spinner-border text-primary" role="status" />
              <p className="meta-copy">Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-panel">
              <h3>No payment requests yet</h3>
              <p>Create one above to exercise the sandbox payment initiation flow.</p>
            </div>
          ) : (
            <div className="feature-list">
              {payments.map((payment) => (
                <article className="feature-list-item" key={payment.id}>
                  <div className="list-head">
                    <div className="list-title">
                      <div className="inline-actions">
                        <span className={`status-chip ${payment.status}`}>{payment.status}</span>
                        <span className="badge-soft info">{payment.account_name}</span>
                      </div>
                      <h3>{payment.payee_name}</h3>
                      <p>{payment.payee_reference || "No reference provided"}</p>
                    </div>
                    <div className="list-title">
                      <strong>{formatCurrency(payment.amount, payment.currency)}</strong>
                      <p>{payment.scheduled_for ? `Scheduled ${new Date(payment.scheduled_for).toLocaleDateString()}` : "Ready to submit"}</p>
                    </div>
                  </div>

                  <div className="list-foot">
                    <p className="meta-copy">{payment.iban || "No IBAN captured"}</p>
                    {payment.status === "initiated" ? (
                      <button type="button" className="btn btn-primary" onClick={() => submitPayment(payment.id)}>
                        Submit payment
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="feature-card">
          <div className="list-title">
            <p className="stat-label">Intake</p>
            <h2>Bill scan results</h2>
          </div>

          {isLoading ? (
            <div className="surface-stack">
              <div className="spinner-border text-primary" role="status" />
              <p className="meta-copy">Loading bill scans...</p>
            </div>
          ) : billScans.length === 0 ? (
            <div className="empty-panel">
              <h3>No bill scans yet</h3>
              <p>Your parsed bill records will appear here after you submit one.</p>
            </div>
          ) : (
            <div className="feature-list">
              {billScans.map((scan) => (
                <article className="feature-list-item" key={scan.id}>
                  <div className="list-head">
                    <div className="list-title">
                      <div className="inline-actions">
                        <span className={`status-chip ${scan.status}`}>{scan.status}</span>
                      </div>
                      <h3>{scan.file_name}</h3>
                      <p>{scan.merchant_name || "Merchant unavailable"}</p>
                    </div>
                    <div className="list-title">
                      <strong>{scan.extracted_amount ? formatCurrency(scan.extracted_amount) : "No amount"}</strong>
                      <p>{scan.extracted_date ? new Date(scan.extracted_date).toLocaleDateString() : "No date found"}</p>
                    </div>
                  </div>

                  {scan.raw_text ? (
                    <details>
                      <summary className="meta-copy">View parsed source text</summary>
                      <pre className="code-card">{scan.raw_text}</pre>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
