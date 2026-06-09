// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../services/authService";
import "../styles/Login.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!email.trim()) {
      setError("יש להזין כתובת אימייל");
      setLoading(false);
      return;
    }

    const result = await forgotPassword(email);
    
    if (result.success) {
      setSuccess("📧 " + result.message);
      setTimeout(() => {
        navigate("/login");
      }, 4000);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <img src="/logo.png" className="logo" alt="מתחברים" />
          <div className="header-text">
            <h1>שכחתי את הסיסמה</h1>
            <p>נישלח לך קישור לאימייל לאיפוס הסיסמה</p>
          </div>
          <hr />

          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="אימייל"
              dir="ltr"
              disabled={loading}
            />

            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text" style={{color: "#2e7d32", background: "#e8f5e9", padding: "10px", borderRadius: "10px", textAlign: "center"}}>{success}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "שולח..." : "שלח קישור לאיפוס"}
            </button>

            <div className="back-link" style={{ textAlign: "center", marginTop: "20px" }}>
              <Link to="/login?role=admin" className="forgot-link">חזרה לעמוד הכניסה</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}