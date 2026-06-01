import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.jpeg";

// NOTE: This is UI only. Real role-based authentication can be added later
// (e.g. checking user role from backend and redirecting accordingly).
export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get("role");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (role === "admin") navigate("/admin");
    else if (role === "volunteer") navigate("/volunteer");
  };

  if (!role) {
    return (
      <div className="login-page">
        <div style={{ width: "100%", maxWidth: 720 }}>
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <img src={logo} alt="מתחברים" style={{ width: 70, marginBottom: 10 }} />
            <h1 style={{ fontSize: 28 }}>כניסה למערכת מתחברים</h1>
            <p style={{ color: "var(--color-text-muted)", marginTop: 6 }}>בחר/י את סוג ההתחברות</p>
          </div>
          <div className="role-cards">
            <Link to="/login?role=admin" className="role-card">
              <div className="role-icon">🛡️</div>
              <h3>כניסת מנהלים</h3>
              <p>למנהלות, רכזות וצוות פנימי</p>
            </Link>
            <Link to="/login?role=volunteer" className="role-card">
              <div className="role-icon">🤝</div>
              <h3>כניסת מתנדבים</h3>
              <p>לאזור הדיווחים האישי של המתנדבים</p>
            </Link>
          </div>
          <div className="login-back"><Link to="/">חזרה לעמוד הבית</Link></div>
        </div>
      </div>
    );
  }

  const isAdmin = role === "admin";
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-header">
          <img src={logo} alt="מתחברים" />
          <h1>{isAdmin ? "כניסת מנהלים" : "כניסת מתנדבים"}</h1>
          <p>{isAdmin ? "התחברות למערכת הניהול הפנימית" : "התחברות לאזור דיווחי המתנדבים"}</p>
        </div>
        <div className="field"><label>אימייל</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label>סיסמה</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div className="login-actions">
          <button type="submit" className="btn btn-primary">{isAdmin ? "כניסה כמנהל" : "כניסה כמתנדב"}</button>
        </div>
        <div className="login-back"><Link to="/">חזרה לעמוד הבית</Link></div>
      </form>
    </div>
  );
}
