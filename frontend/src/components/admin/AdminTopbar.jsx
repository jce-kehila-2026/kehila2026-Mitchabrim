import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import { db, auth } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function AdminTopbar() {
  const navigate = useNavigate();
  
  const [userData, setUserData] = useState({
    name: "טוען...",
    role: "מנהל מערכת",
    initial: "⏳"
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        let finalName = user.displayName;
        let finalRole = "מנהל מערכת";

        // إذا لم يكن الاسم موجوداً في الـ Auth، نقوم بجلبه مباشرة من قاعدة بيانات Firestore
        if (!finalName && user.email) {
          try {
            const q = query(collection(db, "users"), where("email", "==", user.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const dbData = querySnapshot.docs[0].data();
              // نأخذ الاسم سواء كان مسجلاً تحت displayName أو fullName
              finalName = dbData.displayName || dbData.fullName;
              
              if (dbData.role === "admin") finalRole = "מנהל מערכת"; 
              if (dbData.role === "volunteer") finalRole = "מתנדב/ת";
            }
          } catch (error) {
            console.error("Error fetching user data from DB:", error);
          }
        }

        // الحماية الأخيرة: إذا لم يجد الاسم في قاعدة البيانات، يأخذ الجزء الأول من الإيميل
        if (!finalName && user.email) {
          finalName = user.email.split('@')[0];
        }

        setUserData({
          name: finalName || "מנהל",
          role: finalRole,
          initial: finalName ? finalName.charAt(0).toUpperCase() : "מ"
        });
      }
    });
    
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("שגיאה בהתנתקות:", error);
    }
  };

  return (
    <div className="admin-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", backgroundColor: "#fdfbf7", borderBottom: "1px solid #e9ecef" }}>
      
      <style>{`
        .topbar-btn { transition: all 0.2s ease; cursor: pointer; }
        .topbar-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(139,44,44,0.15); }
        .topbar-search-input { transition: all 0.2s ease; }
        .topbar-search-input:focus { border-color: #8b2c2c !important; box-shadow: 0 0 0 3px rgba(139,44,44,0.1) !important; }
      `}</style>

      {/* --- شريط البحث --- */}
      <div style={{ position: "relative", width: "300px" }}>
        <svg style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "#6c757d" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input 
          className="topbar-search-input"
          placeholder="חיפוש מהיר..." 
          style={{ width: "100%", padding: "10px 40px 10px 16px", borderRadius: "30px", border: "1px solid #ced4da", outline: "none", backgroundColor: "#fff", fontSize: "14px", fontFamily: "inherit" }}
        />
      </div>

      {/* --- أزرار التحكم والملف الشخصي --- */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        
        <button 
          onClick={handleLogout}
          className="topbar-btn"
          style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", color: "#8b2c2c", border: "1px solid #8b2c2c", padding: "8px 20px", borderRadius: "30px", fontWeight: "bold", fontSize: "14px" }}
          title="התנתקות מהמערכת"
        >
          התנתק
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>

        <button 
          className="topbar-btn"
          style={{ position: "relative", backgroundColor: "#fff", border: "1px solid #e9ecef", borderRadius: "12px", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", color: "#495057" }}
          aria-label="התראות"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span style={{ position: "absolute", top: "8px", right: "10px", width: "8px", height: "8px", backgroundColor: "#dc3545", borderRadius: "50%", border: "2px solid #fff" }}></span>
        </button>

        <div 
          className="topbar-btn"
          style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#fff", border: "1px solid #e2d8c9", padding: "4px 16px 4px 4px", borderRadius: "40px" }}
        >
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "bold", color: "#8b2c2c", fontSize: "14px", direction: "ltr" }}>{userData.name}</div>
            <div style={{ color: "#6c757d", fontSize: "12px" }}>{userData.role}</div>
          </div>
          <div style={{ width: "38px", height: "38px", backgroundColor: "#8b2c2c", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "16px" }}>
            {userData.initial}
          </div>
        </div>

      </div>
    </div>
  );
}