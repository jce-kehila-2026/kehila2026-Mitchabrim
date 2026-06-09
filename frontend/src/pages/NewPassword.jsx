// src/pages/NewPassword.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../firebase";
import "../styles/Login.css";

export default function NewPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState(null);
  const [validCode, setValidCode] = useState(false);

  // الحصول على رمز التحقق من الرابط
  useEffect(() => {
    const code = searchParams.get("oobCode");
    if (code) {
      setOobCode(code);
      verifyPasswordResetCode(auth, code)
        .then((email) => {
          setValidCode(true);
        })
        .catch(() => {
          setError("קוד לא תקין או פג תוקף");
          setValidCode(false);
        });
    } else {
      setError("קוד לא נמצא");
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!password || !confirmPassword) {
      setError("מלא את כל השדות");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("סיסמה חייבת להכיל לפחות 6 תווים");
      setLoading(false);
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess("הסיסמה שונתה בהצלחה!");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError("שגיאה בשינוי הסיסמה. ייתכן שהקוד פג תוקף");
    }
    
    setLoading(false);
  };

  if (!validCode && !error) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-box">
            <img src="/logo.png" className="logo" alt="מתחברים" />
            <div className="header-text">
              <h1>איפוס סיסמה</h1>
              <p>מאמת...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <img src="/logo.png" className="logo" alt="מתחברים" />
          <div className="header-text">
            <h1>סיסמה חדשה</h1>
            <p>הזן סיסמה חדשה לחשבונך</p>
          </div>
          <hr />

          <form onSubmit={handleSubmit} className="login-form">
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה חדשה"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="login-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="אימות סיסמה"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div className="login-options" style={{ justifyContent: "center" }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>הצג סיסמה</span>
              </label>
            </div>

            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text" style={{color: "#2e7d32", background: "#e8f5e9", padding: "10px", borderRadius: "10px", textAlign: "center"}}>{success}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "שומר..." : "אפס סיסמה"}
            </button>

            <div className="back-link" style={{ textAlign: "center", marginTop: "20px" }}>
              <Link to="/login" className="forgot-link">חזרה לעמוד הכניסה</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
