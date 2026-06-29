import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, getCurrentUser } from "../services/authService";
import { getUserRole } from "../services/userService";
import openEye from "../assets/openEyes.png";
import closeEye from "../assets/closeEyes.png";
import "../styles/Login.css";

export default function Login() {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      checkUserRoleAndRedirect(user.uid);
    }
    
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const checkUserRoleAndRedirect = async (userId) => {
    const role = await getUserRole(userId);
    if (role === "admin") {
      navigate("/admin");
    } else {
      navigate("/volunteer");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError("מלא את כל השדות");
      setLoading(false);
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      navigate(result.redirectTo);
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
          </div>
          <hr />

          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              dir="ltr"
              disabled={loading}
            />

            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                dir="ltr"
                disabled={loading}
              />
              <div className="eye-container">
                <img
                  src={closeEye}
                  className={`eye-icon eye-close ${!showPassword ? "active" : "hidden"}`}
                  onClick={() => setShowPassword(true)}
                  alt="הצג סיסמה"
                />
                <img
                  src={openEye}
                  className={`eye-icon eye-open ${showPassword ? "active" : "hidden"}`}
                  onClick={() => setShowPassword(false)}
                  alt="הסתר סיסמה"
                />
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="login-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>זכור אותי</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">
                שכחתי את הסיסמה?
              </Link>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "מתחבר..." : "כניסה"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}