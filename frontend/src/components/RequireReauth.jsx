import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Gate wrapper: requires the current admin to re-enter their password before
 * rendering `children`. Uses signInWithEmailAndPassword against the current
 * user's email — this does NOT change the auth session on success.
 *
 * Verification is held only in this component's in-memory state. When the
 * admin leaves the sensitive section, the component unmounts and the
 * verification is discarded — returning to the section requires the
 * password again. Inside the section, no repeated prompts occur.
 *
 * Props:
 *  - scope: string identifying the sensitive area (kept for API compatibility).
 *  - title: human title of the area.
 *  - description: explanation shown in the modal.
 *  - children: content to render after successful re-auth.
 */
export default function RequireReauth({ scope, title, description, children }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ok) return children;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const email = auth.currentUser?.email;
    if (!email) { setError("לא ניתן לזהות את המשתמש. יש להתחבר מחדש."); return; }
    if (!password) { setError("יש להזין סיסמה."); return; }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
      setOk(true);
    } catch {
      setError("הסיסמה שגויה. נסה שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(30,15,8,0.55)",
      backdropFilter: "blur(6px)", zIndex: 5000, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20, direction: "rtl",
    }}>
      <form onSubmit={submit} style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 460,
        padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fdecec", display: "grid", placeItems: "center", color: "#8b2c2c", fontSize: 22 }}>🔒</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#8b2c2c" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#6c757d", marginTop: 2 }}>אזור רגיש — נדרש אימות זהות</div>
          </div>
        </div>

        <div style={{
          background: "#fff7ec", border: "1px solid #f0d9a6", color: "#7a5a1a",
          padding: "12px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, marginBottom: 16,
        }}>
          {description}
        </div>

        <div style={{ fontSize: 14, color: "#3c2a1e", marginBottom: 12, fontWeight: 600 }}>
          האם ברצונך להיכנס לאזור זה? נא הזן את סיסמת המנהל לאישור.
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#7a5a4a", marginBottom: 6 }}>סיסמה</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          dir="ltr"
          placeholder="••••••••"
          autoComplete="current-password"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1.5px solid #e2d8c9", outline: "none", fontSize: 15, fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div style={{ marginTop: 10, background: "#fdecec", color: "#9b1c1c", padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button type="button" onClick={() => navigate("/admin")} style={{
            padding: "10px 20px", borderRadius: 10, background: "#fff",
            border: "1px solid #e2d8c9", color: "#495057", fontWeight: 700, cursor: "pointer",
          }}>ביטול וחזרה</button>
          <button type="submit" disabled={busy} style={{
            padding: "10px 22px", borderRadius: 10, background: "#8b2c2c",
            color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", opacity: busy ? .7 : 1,
          }}>{busy ? "מאמת..." : "אישור וכניסה"}</button>
        </div>
      </form>
    </div>
  );
}
