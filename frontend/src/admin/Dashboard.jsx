import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Sun, CloudSun, CloudFog, CloudRain, Snowflake, CloudLightning, Loader2, Gift } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import ProfileUpdateRequestModal from "@/components/admin/ProfileUpdateRequestModal.jsx";
import { useAuth } from "../context/AuthContext";

import { getElderlyCount } from "../services/elderlyService";
import { getVolunteersCount } from "../services/volunteersService";
import { getProjects } from "../services/projectsService";
import {
  getJoinRequestsCount,
  getRecentJoinRequests,
  deleteJoinRequest,
} from "../services/joinRequestsService";
import {
  subscribeAllProfileUpdateRequests,
  deleteProfileUpdateRequest,
} from "../services/profileUpdateRequestsService";
import {
  subscribeAdminTasks,
  createAdminTask,
  updateAdminTaskStatus,
  updateAdminTaskTitle,
  deleteAdminTask,
} from "../services/adminTasksService";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminId = user?.uid || null;
  
  const [stats, setStats] = useState({ elderly: "-", volunteers: "-", requests: "-" });
  const [nearestProject, setNearestProject] = useState(null);
  const [requests, setRequests] = useState([]);
  const [profileRequests, setProfileRequests] = useState([]);
  const [selectedProfileRequest, setSelectedProfileRequest] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [deleteProfileId, setDeleteProfileId] = useState(null);
  const [activeTab, setActiveTab] = useState("update"); // update | special | status
  const [mainTab, setMainTab] = useState("join"); // join | volunteer | tasks
  const [taskFilter, setTaskFilter] = useState("all"); // all | open | overdue | done
  const [viewTask, setViewTask] = useState(null);
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [weather, setWeather] = useState({ temp: "--", text: "טוען...", emoji: <Loader2 size={16} className="animate-spin" /> });

  useEffect(() => {
    let cancelled = false;
    const fetchDashboardData = async () => {
      try {
        const [elderlyCount, volunteersCount, allProjects, requestsCount, joinReqList] =
          await Promise.all([
            getElderlyCount(),
            getVolunteersCount(),
            getProjects(),
            getJoinRequestsCount(),
            getRecentJoinRequests(50),
          ]);
        if (cancelled) return;

        setStats({
          elderly: elderlyCount,
          volunteers: volunteersCount,
          requests: requestsCount,
        });

        // Nearest upcoming/active project
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const parseDate = (s) => {
          if (!s) return null;
          if (typeof s?.toDate === "function") return s.toDate();
          const d = new Date(s);
          return isNaN(d) ? null : d;
        };
        const candidates = allProjects
          .filter((p) => p.status !== "הסתיים" && p.status !== "בוטל")
          .map((p) => ({ ...p, _d: parseDate(p.date || p.startDate || p.distributionDate) }))
          .filter((p) => p._d && p._d >= today)
          .sort((a, b) => a._d - b._d);
        const fallback = allProjects
          .filter((p) => p.status === "פעיל" || p.status === "בהכנה")
          .sort((a, b) => (parseDate(b.createdAt) || 0) - (parseDate(a.createdAt) || 0));
        setNearestProject(candidates[0] || fallback[0] || null);

        const fetchedRequests = joinReqList.map((data) => {
          let cleanNote = data.note || data.reason || data.message || "";
          let requestType = data.type || "לא צוין";
          if (cleanNote.startsWith(requestType + " - ")) {
            cleanNote = cleanNote.replace(requestType + " - ", "").trim();
          }

          return {
            id: data.id,
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

        // Personal admin tasks are loaded in a separate effect filtered by adminId.



      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchDashboardData();
    return () => { cancelled = true; };
  }, []);

  // Live subscription to profile update requests
  useEffect(() => {
    const unsub = subscribeAllProfileUpdateRequests(
      (items) => setProfileRequests(items),
      (err) => console.warn("profileUpdateRequests listen:", err.message),
      { max: 50 }
    );
    return () => unsub();
  }, []);

  // Live subscription to personal admin tasks (filtered by current admin uid)
  useEffect(() => {
    if (!adminId) { setTasks([]); return; }
    const unsub = subscribeAdminTasks(
      adminId,
      (list) => setTasks(list),
      (err) => console.warn("personal tasks listen:", err.message)
    );
    return () => unsub();
  }, [adminId]);


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
          
          let conditionEmoji = <Sun size={16} style={{ color: "#f59e0b" }} />;
          let conditionText = "בהיר";

          if (weatherCode >= 1 && weatherCode <= 3) { conditionEmoji = <CloudSun size={16} style={{ color: "#d9a86c" }} />; conditionText = "מעונן חלקית"; }
          else if (weatherCode >= 45 && weatherCode <= 48) { conditionEmoji = <CloudFog size={16} style={{ color: "#94a3b8" }} />; conditionText = "ערפילי"; }
          else if (weatherCode >= 51 && weatherCode <= 67) { conditionEmoji = <CloudRain size={16} style={{ color: "#3b82f6" }} />; conditionText = "גשום"; }
          else if (weatherCode >= 71 && weatherCode <= 77) { conditionEmoji = <Snowflake size={16} style={{ color: "#38bdf8" }} />; conditionText = "מושלג"; }
          else if (weatherCode >= 80 && weatherCode <= 82) { conditionEmoji = <CloudRain size={16} style={{ color: "#3b82f6" }} />; conditionText = "ממטרים"; }
          else if (weatherCode >= 95 && weatherCode <= 99) { conditionEmoji = <CloudLightning size={16} style={{ color: "#64748b" }} />; conditionText = "סוער"; }

          setWeather({
            temp: `${temperature}°C`,
            text: conditionText,
            emoji: conditionEmoji
          });
        }
      } catch (error) {
        setWeather({ temp: "24°C", text: "ירושלים", emoji: <CloudSun size={16} style={{ color: "#d9a86c" }} /> });
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
    if (!adminId) { showToast("לא ניתן לשמור: משתמש לא מחובר"); return; }

    try {
      await createAdminTask({ adminId, title: newTaskTitle });
      // onSnapshot will refresh the list automatically
      setNewTaskTitle("");
      showToast("המשימה נשמרה במערכת");
    } catch (error) {
      showToast("שגיאה בשמירת המשימה");
    }
  };


  // Personal task statuses — canonical labels used going forward.
  // Older data may still contain the previous labels; helpers normalize them.
  const STATUS_OPTIONS = ["פתוחה", "חשובה", "הושלמה"];
  const normalizeStatus = (s) => {
    if (!s) return "פתוחה";
    if (s === "פתוח" || s === "פתוחה") return "פתוחה";
    if (s === "דחוף" || s === "חשובה") return "חשובה";
    if (s === "בוצע" || s === "הושלמה") return "הושלמה";
    return "פתוחה";
  };
  const setTaskStatus = async (taskId, next) => {
    try {
      await updateAdminTaskStatus(taskId, next);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: next } : t)));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };


  const handleDeleteTask = async (taskId) => {
    try {
      await deleteAdminTask(taskId);
      setTasks(tasks.filter((t) => t.id !== taskId));
      showToast("המשימה נמחקה");
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const startEditTask = (t) => {
    setEditTaskId(t.id);
    setEditTaskTitle(t.title || "");
  };

  const saveEditTask = async () => {
    if (!editTaskId || !editTaskTitle.trim()) { setEditTaskId(null); return; }
    try {
      await updateAdminTaskTitle(editTaskId, editTaskTitle);
      setEditTaskId(null);
      setEditTaskTitle("");
      showToast("המשימה עודכנה");
    } catch (e) {
      showToast("שגיאה בעדכון המשימה");
    }
  };

  const executeDeleteProfileRequest = async (id) => {
    try {
      await deleteProfileUpdateRequest(id);
      setProfileRequests((prev) => prev.filter((r) => r.id !== id));
      setDeleteProfileId(null);
      showToast("הבקשה נמחקה בהצלחה");
    } catch (error) {
      console.error("Error deleting profile update request:", error);
      showToast("שגיאה במחיקת הבקשה");
    }
  };

  const executeDeleteRequest = async (requestId) => {
    try {
      await deleteJoinRequest(requestId);
      setRequests(requests.filter((r) => r.id !== requestId));
      setStats((current) => ({
        ...current,
        requests: Math.max(0, Number(current.requests) - 1),
      }));
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
    <AdminPageLayout heroImage="/admin-heroes/dashboard_hero.webp"
      title={getGreeting()} 
      subtitle="ניהול ענייני המערכת והקהילה מכאן"
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#fff", padding: "8px 14px", borderRadius: "30px", border: "1px solid #edf0f2", boxShadow: "0 2px 5px rgba(0,0,0,0.03)", direction: "rtl", flexWrap: "wrap", maxWidth: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#495057", fontSize: "13.5px", fontWeight: "600" }}>
            <Calendar size={15} style={{ color: "#8b2c2c" }} />
            <span style={{ color: "#343a40" }}>{formatDateHebrew(currentDateTime)}</span>
            <span style={{ color: "#e9ecef", margin: "0 2px" }}>|</span>
            <Clock size={15} style={{ color: "#8b2c2c" }} />
            <span style={{ fontFamily: "monospace", letterSpacing: "0.5px", color: "#495057" }}>{formatTimeLive(currentDateTime)}</span>
          </div>
          <div style={{ width: "1px", height: "16px", backgroundColor: "#e9ecef" }}></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "600", color: "#495057" }} title={`מצב השמיים הנוכחי: ${weather.text}`}>
            <span style={{ display: "inline-flex", alignItems: "center", transform: "translateY(-1px)" }}>{weather.emoji}</span>
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
        .dashboard-card-wrapper { transition: all 0.2s ease-in-out; cursor: pointer; border-radius: 12px; overflow: hidden; height: 100%; }
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

      {/* --- Stats Row (single, balanced) --- */}
      <div className="stats-grid">
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/elderly")}><StatsCard icon="👵" title="סה״כ אזרחים ותיקים" value={stats.elderly} subtitle="מעבר לניהול אזרחים" /></div>
        <div className="dashboard-card-wrapper" onClick={() => navigate("/admin/volunteers")}><StatsCard icon="🤝" title="מתנדבים פעילים" value={stats.volunteers} subtitle="מעבר לניהול מתנדבים" /></div>
        <div
          className="dashboard-card-wrapper"
          onClick={() => navigate(nearestProject ? `/admin/projects/${nearestProject.id}` : "/admin/projects")}
          title={nearestProject ? `מעבר לפרויקט: ${nearestProject.name || ""}` : "מעבר לפרויקטים"}
        >
          <div className="stats-card">
            <div className="stats-icon"><Gift size={22} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>פרויקט קרוב</h3>
              {nearestProject ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#3c2a1e", marginTop: 4, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {nearestProject.name || "ללא שם"}
                  </div>
                  <div className="stats-sub" style={{ marginTop: 4 }}>
                    תאריך: {nearestProject.date || nearestProject.startDate || "—"}
                  </div>
                  <div className="stats-sub">
                    סטטוס: {nearestProject.status || "פעיל"}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: "#6c757d", marginTop: 6 }}>אין פרויקט קרוב כרגע</div>
              )}
            </div>
          </div>
        </div>
        <div className="dashboard-card-wrapper" onClick={() => { setMainTab("join"); document.getElementById("requests-section")?.scrollIntoView({ behavior: "smooth" }); }}><StatsCard icon="✉️" title="פניות לטיפול" value={stats.requests} subtitle="גלילה לבקשות פתוחות" /></div>
      </div>

      {/* --- Main Tabbed Lower Area --- */}
      <div id="requests-section" style={{ direction: "rtl" }}>
        <SectionCard>
          <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #f1e7d7" }}>
            {[
              { k: "join", label: `בקשות הצטרפות${requests.length ? ` (${requests.length})` : ""}` },
              { k: "volunteer", label: "בקשות מתנדבים" },
              { k: "tasks", label: "משימות אישיות" },
            ].map((t) => {
              const active = mainTab === t.k;
              return (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMainTab(t.k)}
                  style={{
                    padding: "10px 22px", borderRadius: 999,
                    border: active ? "1px solid #8b2c2c" : "1px solid #e6d9c4",
                    background: active ? "#8b2c2c" : "#fff",
                    color: active ? "#fff" : "#5a3a2a",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: active ? "0 4px 12px rgba(139,44,44,0.18)" : "none",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Join Requests Tab */}
          {mainTab === "join" && (
            <div>
              <div style={{ fontSize: 13, color: "#6c757d", marginBottom: 10 }}>
                {requests.length > 0 ? `${requests.length} בקשות חדשות` : "אין בקשות חדשות כרגע"}
              </div>
              <div className="scrollbox" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto", paddingLeft: 6 }}>
                {requests.length > 0 ? requests.map((r) => (
                  <div key={r.id} className="interactive-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: "#fff", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: "bold", color: "#343a40", fontSize: 14 }}>{r.name}</div>
                      <div style={{ color: "#6c757d", fontSize: 12, marginTop: 2 }}>
                        {r.type}{r.createdAt ? ` • ${r.createdAt.toLocaleDateString("he-IL")}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setSelectedRequest(r)} style={{ padding: "6px 14px", borderRadius: 6, backgroundColor: "#f8f9fa", border: "1px solid #ced4da", cursor: "pointer", fontWeight: "bold", color: "#495057", fontSize: 12 }}>צפייה</button>
                      <button onClick={() => { showToast("הפנייה אושרה"); executeDeleteRequest(r.id); }} style={{ padding: "6px 14px", borderRadius: 6, backgroundColor: "#1e6b2c", border: "none", cursor: "pointer", fontWeight: "bold", color: "#fff", fontSize: 12 }}>אישור</button>
                      <button onClick={() => setDeleteId(r.id)} style={{ padding: "6px 14px", borderRadius: 6, backgroundColor: "#fff", border: "1px solid #dc3545", cursor: "pointer", fontWeight: "bold", color: "#dc3545", fontSize: 12 }}>דחייה</button>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: 20, textAlign: "center", color: "#adb5bd", fontSize: 14 }}>אין בקשות חדשות כרגע 🎉</div>
                )}
              </div>
            </div>
          )}

          {/* Volunteer Requests Tab (sub-categories) */}
          {mainTab === "volunteer" && (
            <div>
              <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {[
                  { k: "update",  label: "בקשות עדכון פרטים" },
                  { k: "special", label: "בקשות מיוחדות מהמתנדב" },
                  { k: "status",  label: "מצב הבקשה" },
                ].map((t) => {
                  const active = activeTab === t.k;
                  return (
                    <button
                      key={t.k}
                      onClick={() => setActiveTab(t.k)}
                      style={{
                        padding: "6px 14px", borderRadius: 999,
                        border: active ? "1px solid #8b2c2c" : "1px solid #e6d9c4",
                        background: active ? "#fdecec" : "#fff",
                        color: active ? "#8b2c2c" : "#5a3a2a",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ minHeight: 180 }}>
                {activeTab === "update" && (
                  <ProfileRequestList
                    items={profileRequests.filter((r) => !r.type || r.type === "update")}
                    onOpen={setSelectedProfileRequest}
                    setDeleteProfileId={setDeleteProfileId}
                    emptyText="אין בקשות עדכון פרטים כרגע"
                  />
                )}
                {activeTab === "special" && (
                  <ProfileRequestList
                    items={profileRequests.filter((r) => r.type === "special")}
                    onOpen={setSelectedProfileRequest}
                    setDeleteProfileId={setDeleteProfileId}
                    emptyText="אין בקשות מיוחדות מהמתנדבים כרגע"
                  />
                )}
                {activeTab === "status" && (
                  <StatusSummary items={profileRequests} />
                )}
              </div>
            </div>
          )}

          {/* Volunteer Tasks Tab */}
          {mainTab === "tasks" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {[
                  { k: "all", label: `הכל (${tasks.length})` },
                  { k: "open", label: `פתוחות (${tasks.filter(t => normalizeStatus(t.status) === "פתוחה").length})` },
                  { k: "important", label: `חשובות (${tasks.filter(t => normalizeStatus(t.status) === "חשובה").length})` },
                  { k: "done", label: `הושלמו (${tasks.filter(t => normalizeStatus(t.status) === "הושלמה").length})` },
                ].map((f) => {
                  const active = taskFilter === f.k;
                  return (
                    <button key={f.k} onClick={() => setTaskFilter(f.k)} style={{
                      padding: "6px 14px", borderRadius: 999,
                      border: active ? "1px solid #8b2c2c" : "1px solid #e6d9c4",
                      background: active ? "#fdecec" : "#fff",
                      color: active ? "#8b2c2c" : "#5a3a2a",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>{f.label}</button>
                  );
                })}
              </div>
              <div className="scrollbox" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto", paddingLeft: 6 }}>
                {(() => {
                  const filtered = tasks.filter(t => {
                    const s = normalizeStatus(t.status);
                    if (taskFilter === "open") return s === "פתוחה";
                    if (taskFilter === "important") return s === "חשובה";
                    if (taskFilter === "done") return s === "הושלמה";
                    return true;
                  });
                  if (!filtered.length) return <div style={{ padding: 20, textAlign: "center", color: "#adb5bd", fontSize: 14 }}>אין משימות להצגה</div>;
                  return filtered.map((t) => {
                    const isEditing = editTaskId === t.id;
                    const st = normalizeStatus(t.status);
                    const isDone = st === "הושלמה";
                    const isImportant = st === "חשובה";
                    const dotColor = isImportant ? "#dc3545" : isDone ? "#1e6b2c" : "#c9a227";
                    const rowBg = isDone ? "#f4faf5" : isImportant ? "#fff5f5" : "#fff";
                    const rowBorder = isDone ? "1px solid #c3e6cb" : isImportant ? "1px solid #f5c6cb" : "1px solid #e9ecef";
                    const badge = isDone
                      ? { bg: "#e8f5e9", color: "#1e6b2c", border: "#c3e6cb" }
                      : isImportant
                      ? { bg: "#fdecec", color: "#dc3545", border: "#f5c6cb" }
                      : { bg: "#fff3cd", color: "#856404", border: "#ffeeba" };
                    return (
                      <div key={t.id} className="interactive-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: rowBg, border: rowBorder, gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 8 }}>
                          <span title={st} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0 }} />
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editTaskTitle}
                              onChange={(e) => setEditTaskTitle(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEditTask(); if (e.key === "Escape") setEditTaskId(null); }}
                              style={{ flex: 1, padding: "6px 8px", border: "1px solid #c9a227", borderRadius: 6, fontSize: 13.5, fontFamily: "inherit" }}
                            />
                          ) : (
                            <span style={{ color: isDone ? "#adb5bd" : isImportant ? "#8b2c2c" : "#495057", fontSize: 13.5, fontWeight: isImportant ? 700 : 500, textDecoration: isDone ? "line-through" : "none" }}>{t.title}</span>
                          )}
                          <span style={{ marginInlineStart: 4, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{st}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEditTask} style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "#1e6b2c", border: "none", cursor: "pointer", fontWeight: "bold", color: "#fff", fontSize: 12 }}>שמירה</button>
                              <button onClick={() => setEditTaskId(null)} style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "#fff", border: "1px solid #ced4da", cursor: "pointer", fontWeight: "bold", color: "#495057", fontSize: 12 }}>ביטול</button>
                            </>
                          ) : (
                            <>
                              <select
                                value={st}
                                onChange={(e) => setTaskStatus(t.id, e.target.value)}
                                title="שינוי סטטוס"
                                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ced4da", backgroundColor: "#fff", color: "#495057", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                              >
                                {STATUS_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                              </select>
                              <button onClick={() => setViewTask(t)} style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "#f8f9fa", border: "1px solid #ced4da", cursor: "pointer", fontWeight: "bold", color: "#495057", fontSize: 12 }}>צפייה</button>
                              <button onClick={() => startEditTask(t)} style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "#fff7ec", border: "1px solid #f0c98a", cursor: "pointer", fontWeight: "bold", color: "#a07050", fontSize: 12 }}>עריכה</button>
                              <button type="button" onClick={() => handleDeleteTask(t.id)} className="icon-btn-danger" title="מחיקה" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: "bold", padding: 0 }}>✕</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });

                })()}
              </div>

              <form onSubmit={handleAddTask} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px dashed #ced4da", borderRadius: 10, backgroundColor: "#faf8f5", marginTop: 12 }}>
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="הוסף משימה חדשה ללוח..." style={{ background: "transparent", border: "none", outline: "none", flex: 1, fontSize: 13, color: "#495057", fontFamily: "inherit" }} />
                <button type="submit" style={{ backgroundColor: "#8b2c2c", color: "white", border: "none", borderRadius: "50%", width: 24, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, fontWeight: "bold", padding: 0 }}>+</button>
              </form>
            </div>
          )}
        </SectionCard>
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
                <button onClick={async () => { const id = selectedRequest.id; setSelectedRequest(null); await executeDeleteRequest(id); showToast("הפנייה אושרה והוסרה מהרשימה"); }} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", backgroundColor: "#1e6b2c", color: "white", cursor: "pointer", fontWeight: "bold" }}>אשר פנייה</button>
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

      {/* --- Delete Profile Request Confirmation Modal --- */}
      {deleteProfileId && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl" }}>
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "16px", textAlign: "center", width: "90%", maxWidth: "350px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <div style={{ backgroundColor: "#fdecec", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h4 style={{ color: "#343a40", fontWeight: "bold", margin: "0 0 8px 0" }}>האם למחוק את הבקשה?</h4>
            <p style={{ color: "#6c757d", fontSize: "14px", margin: "0 0 24px 0" }}>פעולה זו תמחק את בקשת עדכון הפרטים לצמיתות.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeleteProfileId(null)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ced4da", backgroundColor: "#fff", cursor: "pointer", fontWeight: "bold", color: "#495057" }}>ביטול</button>
              <button onClick={() => executeDeleteProfileRequest(deleteProfileId)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "#dc3545", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>כן, מחק</button>
            </div>
          </div>
        </div>
      )}

      {selectedProfileRequest && (
        <ProfileUpdateRequestModal
          request={selectedProfileRequest}
          onClose={() => setSelectedProfileRequest(null)}
          onDecided={(updated) => {
            setProfileRequests((current) =>
              current.map((request) => request.id === updated.id ? updated : request)
            );
            setSelectedProfileRequest(updated);
          }}
        />
      )}

      {/* --- Personal Task View Modal --- */}
      {viewTask && (
        <div onClick={() => setViewTask(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, direction: "rtl" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "90%", maxWidth: 420, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 6px 0", color: "#8b2c2c", fontWeight: "bold", fontSize: "1.15rem" }}>פרטי משימה אישית</h3>
            <p style={{ color: "#6c757d", fontSize: 13, margin: "0 0 16px 0" }}>משימה פרטית שנשמרה על ידך</p>
            <div style={{ backgroundColor: "#faf8f5", padding: 16, borderRadius: 8, marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#343a40", marginBottom: 10, whiteSpace: "pre-wrap" }}>{viewTask.title}</div>
              <div style={{ fontSize: 12.5, color: "#6c757d" }}>
                סטטוס: <strong style={{ color: "#495057" }}>{viewTask.status || "פתוח"}</strong>
              </div>
              {viewTask.createdAt?.toDate && (
                <div style={{ fontSize: 12.5, color: "#6c757d", marginTop: 4 }}>
                  נוצר ב־{viewTask.createdAt.toDate().toLocaleString("he-IL")}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { startEditTask(viewTask); setViewTask(null); }} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #f0c98a", backgroundColor: "#fff7ec", color: "#a07050", fontWeight: "bold", cursor: "pointer" }}>עריכה</button>
              <button onClick={() => setViewTask(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#8b2c2c", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>סגירה</button>
            </div>
          </div>
        </div>
      )}

    </AdminPageLayout>
  );
}

function ProfileRequestList({ items, onOpen, setDeleteProfileId, emptyText }) {
  const statusMap = {
    pending:  { label: "ממתין", bg: "#fff3cd", color: "#856404", border: "#ffeeba" },
    approved: { label: "אושר",  bg: "#e8f5e9", color: "#1e6b2c", border: "#c3e6cb" },
    rejected: { label: "נדחה",  bg: "#fdecec", color: "#dc3545", border: "#f5c6cb" },
  };
  if (!items.length) {
    return <div style={{ padding: "20px", textAlign: "center", color: "#adb5bd", fontSize: "13px" }}>{emptyText}</div>;
  }
  return (
    <div className="scrollbox" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto", paddingLeft: 6 }}>
      {items.map((r) => {
        const d = r.createdAt?.toDate ? r.createdAt.toDate() : null;
        const s = statusMap[r.status] || statusMap.pending;
        const preview = (r.message || "").length > 60 ? (r.message || "").slice(0, 60) + "…" : (r.message || "");
        return (
          <div key={r.id} className="interactive-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: "#fff", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: "bold", color: "#343a40", fontSize: 14 }}>{r.volunteerName || "מתנדב"}</span>
                <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: "bold", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                {d && <span style={{ color: "#9e8a7a", fontSize: 11 }}>{d.toLocaleDateString("he-IL")}</span>}
              </div>
              <div style={{ color: "#6c757d", fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview || "ללא הודעה"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => onOpen(r)}
                style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "#f8f9fa", border: "1px solid #ced4da", cursor: "pointer", fontWeight: "bold", color: "#495057", fontSize: 12 }}
              >
                צפייה
              </button>
              <button
                type="button"
                onClick={() => setDeleteProfileId(r.id)}
                className="icon-btn-danger"
                title="מחיקה"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: "bold", padding: 0 }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusSummary({ items }) {
  const counts = items.reduce(
    (acc, r) => {
      const k = r.status || "pending";
      acc[k] = (acc[k] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
  );
  const cards = [
    { k: "total",    label: "סה״כ בקשות", color: "#8b2c2c", bg: "#fdecec" },
    { k: "pending",  label: "ממתינות",     color: "#856404", bg: "#fff3cd" },
    { k: "approved", label: "אושרו",       color: "#1e6b2c", bg: "#e8f5e9" },
    { k: "rejected", label: "נדחו",        color: "#dc3545", bg: "#fdecec" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
      {cards.map((c) => (
        <div
          key={c.k}
          style={{
            background: c.bg, borderRadius: 12, padding: "14px 12px",
            textAlign: "center", border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{counts[c.k] || 0}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5a3a2a", marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
