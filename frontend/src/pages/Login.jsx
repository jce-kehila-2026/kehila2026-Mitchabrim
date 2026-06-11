import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.jpeg";
import { login } from "../services/authService";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate(result.redirectTo, { replace: true });
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-header">
          <img src={logo} alt="מתחברים" />
          <h1>התחברות למערכת</h1>
          <p>הכניסו את פרטי ההתחברות שלכם</p>
        </div>
        <div className="field">
          <label>אימייל</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            dir="ltr"
          />
        </div>
        <div className="field">
          <label>סיסמה</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div
            style={{
              background: "#fdecec",
              color: "#9b1c1c",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 14,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div className="login-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </div>
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 13, marginTop: 16 }}>
          תופנו אוטומטית לאזור המתאים בהתאם להרשאות החשבון שלכם.
        </p>
        <div className="login-back"><Link to="/">חזרה לעמוד הבית</Link></div>
      </form>
    </div>
  );
}
