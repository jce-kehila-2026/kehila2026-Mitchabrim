import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.jpeg";

export default function VolunteerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); navigate("/volunteer"); }}>
        <div className="login-card-header">
          <img src={logo} alt="מתחברים" />
          <h1>אזור מתנדבים</h1>
          <p>התחברות למערכת דיווחי מתנדבים</p>
        </div>
        <div className="field"><label>אימייל</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label>סיסמה</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div className="login-actions">
          <button type="submit" className="btn btn-primary">התחברות</button>
          <button type="button" className="btn">כניסה עם Google</button>
        </div>
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 13, marginTop: 16 }}>
          הכניסה מיועדת למתנדבים רשומים בלבד
        </p>
        <div className="login-back"><Link to="/">חזרה לעמוד הבית</Link></div>
      </form>
    </div>
  );
}
