import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({ elderly: "-", volunteers: "-", projects: "-", requests: "-", parliaments: "-" });
  const [requests, setRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [weather, setWeather] = useState({ temp: "--", text: "טוען...", emoji: "⏳" });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const elderlySnap = await getDocs(collection(db, "elderly"));
        const volunteersSnap = await getDocs(collection(db, "volunteers"));
        const projectsSnap = await getDocs(collection(db, "projects"));
        const requestsSnap = await getDocs(collection(db, "joinRequests"));
        const parliamentsSnap = await getDocs(collection(db, "parliaments"));

        setStats({
          elderly: elderlySnap.size,
          volunteers: volunteersSnap.size,
          projects: projectsSnap.size,
          requests: requestsSnap.size,
          parliaments: parliamentsSnap.size
        });

        const reqDocs = await getDocs(collection(db, "joinRequests"));
        const fetchedRequests = reqDocs.docs.map(d => {
          const data = d.data();
          let cleanNote = data.note || data.reason || data.message || "";
          let requestType = data.type || "לא צוין";
          if (cleanNote.startsWith(requestType + " - ")) {
            cleanNote = cleanNote.replace(requestType + " - ", "").trim();
          }

          return {
            id: d.id,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.fullName || "ללא שם",
            type: requestType,
            note: cleanNote || "ללא הודעה",
            phone: data.phone || data.phoneNumber || "לא צוין",
            email: data.email || "לא צוין",
            createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null
          };
        });

        fetchedRequests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRequests(fetchedRequests);

        const taskDocs = await getDocs(collection(db, "tasks"));
        setTasks(taskDocs.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000); 

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchLiveWeather = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); 

      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=31.7683&longitude=35.2137&current_weather=true",
          { signal: controller.signal }
        );
        
        clearTimeout(timeoutId); 
        const data = await response.json();
        
        if (data && data.current_weather) {
          const temperature = Math.round(data.current_weather.temperature);
          const weatherCode = data.current_weather.weathercode;
          
          let conditionEmoji = "☀️";
          let conditionText = "בהיר";

          if (weatherCode >= 1 && weatherCode <= 3) { conditionEmoji = "🌤️"; conditionText = "מעונן חלקית"; }
          else if (weatherCode >= 45 && weatherCode <= 48) { conditionEmoji = "🌫️"; conditionText = "ערפילי"; }
          else if (weatherCode >= 51 && weatherCode <= 67) { conditionEmoji = "🌧️"; conditionText = "גשום"; }
          else if (weatherCode >= 71 && weatherCode <= 77) { conditionEmoji = "❄️"; conditionText = "מושלג"; }
          else if (weatherCode >= 80 && weatherCode <= 82) { conditionEmoji = "🌧️"; conditionText = "ממטרים"; }
          else if (weatherCode >= 95 && weatherCode <= 99) { conditionEmoji = "⛈️"; conditionText = "סוער"; }

          setWeather({
            temp: `${temperature}°C`,
            text: conditionText,
            emoji: conditionEmoji
          });
        }
      } catch (error) {
        setWeather({ temp: "24°C", text: "ירושלים", emoji: "🌤️" });
      }
    };

    fetchLiveWeather();
  }, []);

  const formatDateHebrew = (dateObj) => {
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(dateObj);
  };

  const formatTimeLive = (dateObj) => {
    return dateObj.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit" 
    });
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle?.trim()) return;

    try {
      const docRef = await addDoc(collection(db, "tasks"), {
        title: newTaskTitle.trim(),
        status: "פתוח",
        createdAt: serverTimestamp()
      });
      
      setTasks([{ id: docRef.id, title: newTaskTitle.trim(), status: "פתוח" }, ...tasks]);
      setNewTaskTitle("");
      showToast("המשימה נשמרה במערכת");
    } catch (error) {
      showToast("שגיאה בשמירת המשימה");
    }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    let nextStatus = "פתוח";
    if (currentStatus === "פתוח") nextStatus = "דחוף";
    else if (currentStatus === "דחוף") nextStatus = "בוצע";

    try {
      await updateDoc(doc(db, "tasks", taskId), { status: nextStatus });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      setTasks(tasks.filter((t) => t.id !== taskId));
      showToast("המשימה נמחקה");
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const executeDeleteRequest = async (requestId) => {
    try {
      await deleteDoc(doc(db, "joinRequests", requestId));
      setRequests(requests.filter((r) => r.id !== requestId));
      setSelectedRequest(null);
      setDeleteId(null);
      showToast("הפנייה נמחקה בהצלחה");
    } catch (error) {
      console.error("Error deleting request:", error);
      showToast("שגיאה במחיקת הפנייה");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "בוקר טוב";
    if (hour >= 12 && hour < 17) return "צהריים טובים";
    if (hour >= 17 && hour < 22) return "ערב טוב";
    return "לילה טוב";
  };

  const [toast, setToast] = useState("");
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const getBadgeStyle = (status) => {
    if (status === "דחוף") return { backgroundColor: "#fdecec", color: "#dc3545", border: "1px solid #f5c6cb" };
    if (status === "בוצע") return { backgroundColor: "#e8f5e9", color: "#1e6b2c", border: "1px solid #c3e6cb", textDecoration: "line-through" };
    return { backgroundColor: "#fff3cd", color: "#856404", border: "1px solid #ffeeba" };
  };

  return (
    <AdminLayout
      title={getGreeting()} 
      subtitle="ניהול ענייני המערכת והקהילה מכאן"
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "16px", backgroundColor: "#fff", padding: "8px 18px", borderRadius: "30px", border: "1px solid #edf0f2", boxShadow: "0 2px 5px rgba(0,0,0,0.03)", direction: "rtl" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#495057", fontSize: "13.5px", fontWeight: "600" }}>
            <span style={{ fontSize: "15px" }}>📅</span>
            <span style={{ color: "#343a40" }}>{formatDateHebrew(currentDateTime)}</span>
            <span style={{ color: "#e9ecef", margin: "0 2px" }}>|</span>
            <span style={{ fontSize: "15px" }}>🕒</span>
            <span style={{ fontFamily: "monospace", letterSpacing: "0.5px", color: "#495057" }}>{formatTimeLive(currentDateTime)}</span>
          </div>
          <div style={{ width: "1px", height: "16px", backgroundColor: "#e9ecef" }}></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "600", color: "#495057" }} title={`מצב השמיים הנוכחי: ${weather.text}`}>
            <span style={{ fontSize: "18px", display: "inline-block", transform: "translateY(-1px)" }}>{weather.emoji}</span>
            <span style={{ color: "#8b2c2c", fontSize: "14px", fontWeight: "bold" }}>{weather.temp}</span>
            <span style={{ color: "#adb5bd", fontSize: "11.5px", fontWeight: "normal" }}>({weather.text})</span>
          </div>
        </div>
      }
    >
      {toast && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#333", color: "#fff", padding: "10px 20px", borderRadius: "20px", zIndex: 2000, fontSize: "13px", fontWeight: "bold", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      <style>{`
        .compact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px; }
        .dashboard-card-wrapper { transition: all 0.2s ease-in-out; cursor: pointer; border-radius: 12px; overflow: hidden; }
        .dashboard-card-wrapper:hover { transform: translateY(-3px); box-shadow: 0 6px 15px rgba(139,44,44,0.1); }
        .interactive-row { transition: 0.2s; border: 1px solid #e9ecef; border-radius: 10px; flex-shrink: 0; }
        .interactive-row:hover { border-color: #8b2c2c !important; background-color: #fcfbf9; }
        .icon-btn-danger { transition: all 0.2s ease; color: #adb5bd; }
        .icon-btn-danger:hover { color: #dc3545 !important; transform: scale(1.15); }
        .scrollbox::-webkit-scrollbar { width: 6px; }
        .scrollbox::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .scrollbox::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }
        .scrollbox::-webkit-scrollbar-thumb:hover { background: #8b2c2c; }
      `}</style>

      {/* --- Row 1 --- */}
      <div className="compact-grid">
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/elderly")}><StatsCard icon="👵" title="סה״כ אזרחים ותיקים" value={stats.elderly} subtitle="מעבר לניהול אזרחים" /></div>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/volunteers")}><StatsCard icon="🤝" title="מתנדבים פעילים" value={stats.volunteers} subtitle="מעבר לניהול מתנדבים" /></div>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/projects")}><StatsCard icon="🎁" title="פרויקטים פעילים" value={stats.projects} subtitle="מעבר לפרויקטים" /></div>
        <div className="dashboard-card-wrapper" onClick={() => document.getElementById("requests-section").scrollIntoView({ behavior: "smooth" })}><StatsCard icon="✉️" title="פניות לטיפול" value={stats.requests} subtitle="גלילה לבקשות פתוחות" /></div>
      </div>

      {/* --- Row 2 --- */}
      <div className="compact-grid" style={{ marginBottom: "24px" }}>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/parliaments")}><StatsCard icon="🏛️" title="מפגשי פרלמנט השבוע" value={stats.parliaments} subtitle="פרלמנטים פעילים" /></div>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/media")}><StatsCard icon="🖼️" title="מאגר תמונות" value="←" subtitle="עריכת גלריית תמונות" /></div>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/links")}><StatsCard icon="🔗" title="מאגר קישורים" value="←" subtitle="טפסים ומסמכי מערכת" /></div>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/settings")}><StatsCard icon="⚙️" title="הגדרות מערכת" value="←" subtitle="אזורים, קטגוריות וצוות" /></div>
      </div>

      {/* --- Split Section --- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", direction: "rtl" }}>
        
        {/* Requests Scrollbox */}
        <div id="requests-section">
          <SectionCard title="בקשות הצטרפות אחרונות">
            <div className="scrollbox" style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto", paddingLeft: "6px" }}>
              {requests.length > 0 ? requests.map((r) => (
                <div key={r.id} className="interactive-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "10px", backgroundColor: "#fff" }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#343a40", fontSize: "14px" }}>{r.name}</div>
                    <div style={{ color: "#6c757d", fontSize: "12px", marginTop: "2px" }}>{r.type}</div>
                  </div>
                  <button onClick={() => setSelectedRequest(r)} style={{ padding: "6px 14px", borderRadius: "6px", backgroundColor: "#f8f9fa", border: "1px solid #ced4da", cursor: "pointer", fontWeight: "bold", color: "#495057", fontSize: "12px", transition: "0.2s" }}>צפייה</button>
                </div>
              )) : (
                <div style={{ padding: "20px", textAlign: "center", color: "#adb5bd", fontSize: "14px" }}>אין בקשות חדשות כרגע 🎉</div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Tasks Scrollbox */}
        <div>
          <SectionCard title="משימות והתראות">
            <div className="scrollbox" style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto", paddingLeft: "6px" }}>
              {tasks.length > 0 ? tasks.map((t) => (
                <div key={t.id} className="interactive-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "10px", backgroundColor: "#fff" }}>
                  <div style={{ color: t.status === "בוצע" ? "#adb5bd" : "#495057", fontSize: "13.5px", fontWeight: "500", flex: 1, paddingLeft: "10px", textDecoration: t.status === "בוצע" ? "line-through" : "none" }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span onClick={() => toggleTaskStatus(t.id, t.status)} style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "bold", cursor: "pointer", transition: "0.2s", ...getBadgeStyle(t.status) }}>{t.status}</span>
                    <button type="button" onClick={() => handleDeleteTask(t.id)} className="icon-btn-danger" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "bold", padding: 0, display: "flex", alignItems: "center" }}>✕</button>
                  </div>
                </div>
              )) : (
                <div style={{ padding: "10px", textAlign: "center", color: "#adb5bd", fontSize: "14px" }}>אין משימות פתוחות. איזה כיף!</div>
              )}
            </div>
            <form onSubmit={handleAddTask} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", border: "1px dashed #ced4da", borderRadius: "10px", backgroundColor: "#faf8f5", marginTop: "12px" }}>
              <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="הוסף משימה חדשה ללוח..." style={{ background: "transparent", border: "none", outline: "none", flex: 1, fontSize: "13px", color: "#495057", fontFamily: "inherit" }} />
              <button type="submit" style={{ backgroundColor: "#8b2c2c", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", fontWeight: "bold", padding: 0 }}>+</button>
            </form>
          </SectionCard>
        </div>

      </div>

      {/* --- Quick Preview Modal --- */}
      {selectedRequest && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, direction: "rtl" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 6px 0", color: "#8b2c2c", fontWeight: "bold", fontSize: "1.2rem" }}>פרטי פנייה הצטרפות</h3>
            <p style={{ color: "#6c757d", fontSize: "13px", margin: "0 0 20px 0" }}>בקשה חדשה ממתינה לטיפול במערכת</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "right", backgroundColor: "#faf8f5", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
              <div><strong style={{ color: "#495057", fontSize: "13px" }}>שם מלא:</strong> <span style={{ fontSize: "14px" }}>{selectedRequest.name}</span></div>
              <div><strong style={{ color: "#495057", fontSize: "13px" }}>סוג הפנייה:</strong> <span style={{ fontSize: "14px" }}>{selectedRequest.type}</span></div>
              {selectedRequest.note && selectedRequest.note !== "ללא הודעה" && (
                <div><strong style={{ color: "#495057", fontSize: "13px" }}>הודעה:</strong> <span style={{ fontSize: "14px" }}>{selectedRequest.note}</span></div>
              )}
              <div><strong style={{ color: "#495057", fontSize: "13px" }}>טלפון:</strong> <span style={{ fontSize: "14px" }} dir="ltr">{selectedRequest.phone}</span></div>
              <div><strong style={{ color: "#495057", fontSize: "13px" }}>אימייל:</strong> <span style={{ fontSize: "14px" }}>{selectedRequest.email}</span></div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
              <button 
                onClick={() => setDeleteId(selectedRequest.id)} 
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #dc3545", backgroundColor: "transparent", color: "#dc3545", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#dc3545"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#dc3545"; }}
              >
                מחק פנייה
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setSelectedRequest(null)} style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #ced4da", backgroundColor: "#fff", cursor: "pointer", fontWeight: "bold", color: "#6c757d" }}>סגור</button>
                <button onClick={() => { showToast("הפנייה הועברה לטיפול במערכת"); setSelectedRequest(null); navigate("/admin/requests"); }} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", backgroundColor: "#8b2c2c", color: "white", cursor: "pointer", fontWeight: "bold" }}>אשר פנייה</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteId && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl" }}>
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "16px", textAlign: "center", width: "90%", maxWidth: "350px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <div style={{ backgroundColor: "#fdecec", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h4 style={{ color: "#343a40", fontWeight: "bold", margin: "0 0 8px 0" }}>האם אתה בטוח?</h4>
            <p style={{ color: "#6c757d", fontSize: "14px", margin: "0 0 24px 0" }}>פעולה זו תמחק את הפנייה לצמיתות ולא ניתן יהיה לשחזר אותה.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ced4da", backgroundColor: "#fff", cursor: "pointer", fontWeight: "bold", color: "#495057" }}>ביטול</button>
              <button onClick={() => executeDeleteRequest(deleteId)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "#dc3545", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>כן, מחק פנייה</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}