// src/admin/Links.jsx
import { useState, useEffect } from "react";
import AdminLayout from "../components/admin/AdminLayout.jsx";
import SectionCard from "../components/admin/SectionCard.jsx";
import SearchFilters from "../components/admin/SearchFilters.jsx";
import DataTable from "../components/admin/DataTable.jsx";
import { auth } from "../firebase";
import { 
  getAllLinks, 
  addLink, 
  updateLink, 
  deleteLink, 
  formatDate, 
  normalizeUrl 
} from "../services/linkService.js";

// الفئات حسب ملف المتطلبات
const CATEGORIES = ["עירייה", "ביטוח מתנדבים", "רישום משתתפי פרלמנט", "עדכון מפגשי פרלמנט", "קנבה", "מתנדבים", "ביטוח", "הדרכה", "מקורות", "אחר"];

export default function Links() {
  const [links, setLinks] = useState([]);
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [editingLink, setEditingLink] = useState(null);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [alertMessage, setAlertMessage] = useState({ show: false, text: "", type: "" });

  const [formData, setFormData] = useState({
    title: "",
    url: "",
    category: "",
    description: "",
  });

  const showAlert = (text, type = "success") => {
    setAlertMessage({ show: true, text, type });
    setTimeout(() => setAlertMessage({ show: false, text: "", type: "" }), 3000);
  };

  // فتح مربع الخيارات عند الضغط على الاسم
  const handleTitleClick = (link) => {
    setSelectedLink(link);
    setShowActionModal(true);
  };

  // فتح نموذج التعديل من المربع
  const handleEditFromModal = () => {
    if (!selectedLink) return;
    setEditingLink(selectedLink);
    setFormData({
      title: selectedLink.title || "",
      url: selectedLink.url || "",
      category: selectedLink.category || "",
      description: selectedLink.description || "",
    });
    setShowActionModal(false);
    setShowForm(true);
  };

  // حذف من المربع
  const handleDeleteFromModal = async () => {
    if (!selectedLink) return;
    setShowActionModal(false);
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הקישור "${selectedLink.title}"?`)) {
      try {
        await deleteLink(selectedLink.id);
        await fetchLinks();
        showAlert("✅ הקישור נמחק בהצלחה!", "success");
      } catch (error) {
        showAlert("❌ שגיאה במחיקת הקישור: " + error.message, "error");
      }
    }
  };

  // التحقق من المستخدم
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // جلب الروابط باستخدام الـ Service
  const fetchLinks = async () => {
    setLoading(true);
    try {
      const data = await getAllLinks();
      const linksWithDate = data.map((link) => ({
        ...link,
        date: formatDate(link.createdAt),
      }));
      setLinks(linksWithDate);
      setFilteredLinks(linksWithDate);
    } catch (error) {
      showAlert("שגיאה בטעינת הקישורים: " + error.message, "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // فلترة الروابط
  useEffect(() => {
    let filtered = [...links];
    if (searchTerm) {
      filtered = filtered.filter(
        (link) =>
          link.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.url?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory && selectedCategory !== "הכל") {
      filtered = filtered.filter((link) => link.category === selectedCategory);
    }
    setFilteredLinks(filtered);
  }, [searchTerm, selectedCategory, links]);

  // إضافة رابط جديد
  const handleAddLink = async (e) => {
    e.preventDefault();
    const url = normalizeUrl(formData.url);
    try {
      await addLink({
        title: formData.title.trim(),
        url: url,
        category: formData.category,
        description: formData.description?.trim() || "",
        createdBy: user?.email || "unknown",
      });
      setShowForm(false);
      setFormData({ title: "", url: "", category: "", description: "" });
      await fetchLinks();
      showAlert("✅ הקישור נוסף בהצלחה!", "success");
    } catch (error) {
      showAlert("❌ שגיאה בהוספת הקישור: " + error.message, "error");
    }
  };

  // تحديث رابط
  const handleUpdateLink = async (e) => {
    e.preventDefault();
    const url = normalizeUrl(formData.url);
    try {
      await updateLink(editingLink.id, {
        title: formData.title.trim(),
        url: url,
        category: formData.category,
        description: formData.description?.trim() || "",
      });
      setEditingLink(null);
      setFormData({ title: "", url: "", category: "", description: "" });
      setShowForm(false);
      await fetchLinks();
      showAlert("✅ הקישור עודכן בהצלחה!", "success");
    } catch (error) {
      showAlert("❌ שגיאה בעדכון הקישור: " + error.message, "error");
    }
  };

  const handleEditClick = (link) => {
    setEditingLink(link);
    setFormData({
      title: link.title || "",
      url: link.url || "",
      category: link.category || "",
      description: link.description || "",
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingLink(null);
    setFormData({ title: "", url: "", category: "", description: "" });
  };

  return (
    <AdminLayout
      title="מאגר קישורים"
      subtitle="קישורים חשובים ונגישים לצוות"
      actions={
        <button onClick={() => setShowForm(true)} style={{ backgroundColor: "#8B0000", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          + הוספת קישור
        </button>
      }
    >
      {/* رسالة التنبيه */}
      {alertMessage.show && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 1000,
          padding: "12px 20px", borderRadius: "8px",
          backgroundColor: alertMessage.type === "success" ? "#4CAF50" : "#f44336",
          color: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
        }}>
          {alertMessage.text}
        </div>
      )}

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש קישור..."
          searchValue={searchTerm}
          onSearchChange={(e) => setSearchTerm(e.target.value)}
          filters={[
            {
              label: "קטגוריה",
              options: ["הכל", ...CATEGORIES],
              value: selectedCategory,
              onChange: (e) => setSelectedCategory(e.target.value),
            },
          ]}
        />

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>טוען קישורים...</div>
        ) : (
          <DataTable
            columns={[
              { 
                key: "title", 
                label: "כותרת",
                render: (r) => (
                  <button
                    onClick={() => handleTitleClick(r)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#8B0000",
                      cursor: "pointer",
                      fontWeight: "bold",
                      textDecoration: "underline",
                      fontSize: "14px"
                    }}
                  >
                    {r.title}
                  </button>
                )
              },
              { 
                key: "category", 
                label: "קטגוריה", 
                render: (r) => <span style={{ backgroundColor: "#f0f0f0", padding: "4px 8px", borderRadius: "12px" }}>{r.category}</span> 
              },
              { 
                key: "url", 
                label: "קישור", 
                render: (r) => <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "#8B0000" }}>פתח קישור ↗</a> 
              },
              { key: "description", label: "תיאור" },
              { key: "date", label: "תאריך הוספה" },
            ]}
            data={filteredLinks}
          />
        )}
      </SectionCard>

      {/* مربع الخيارات (Action Modal) - عند الضغط على الاسم */}
      {showActionModal && selectedLink && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }} onClick={() => setShowActionModal(false)}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "16px",
            padding: "24px",
            width: "320px",
            maxWidth: "90%",
            textAlign: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
          }} onClick={(e) => e.stopPropagation()}>
            
            <h3 style={{ marginBottom: "8px", fontSize: "18px" }}>{selectedLink.title}</h3>
            <p style={{ color: "#666", marginBottom: "24px", fontSize: "14px" }}>בחר פעולה</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={handleEditFromModal}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  padding: "12px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold"
                }}
              >
                ✏️ עריכה
              </button>
              
              <button
                onClick={handleDeleteFromModal}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  padding: "12px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold"
                }}
              >
                🗑️ מחיקה
              </button>
              
              <button
                onClick={() => setShowActionModal(false)}
                style={{
                  backgroundColor: "#ccc",
                  color: "#333",
                  padding: "10px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  marginTop: "8px"
                }}
              >
                ❌ ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نموذج إضافة/تعديل رابط */}
      {showForm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }} onClick={handleCloseForm}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "24px", width: "500px", maxWidth: "90%" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px" }}>{editingLink ? "עריכת קישור" : "הוספת קישור חדש"}</h2>
            <form onSubmit={editingLink ? handleUpdateLink : handleAddLink}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>כותרת *</label>
                <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px" }} />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>קישור (URL) *</label>
                <input type="text" required value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px" }} />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>קטגוריה *</label>
                <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <option value="">בחר קטגוריה...</option>
                  {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>תיאור</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px", minHeight: "80px" }} />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={handleCloseForm} style={{ padding: "8px 16px", backgroundColor: "#ccc", border: "none", borderRadius: "6px", cursor: "pointer" }}>ביטול</button>
                <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#8B0000", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>{editingLink ? "עדכן" : "שמור"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}