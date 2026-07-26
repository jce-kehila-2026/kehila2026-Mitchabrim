// src/admin/Links.jsx
import { useState, useEffect } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
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
import { validateUrl } from "@/utils/validation";
import { sanitizeText } from "@/utils/sanitize";
import useSettingsCategories from "@/hooks/useSettingsCategories";
import { LINK_CATEGORIES_TITLE } from "@/utils/categorySettings";

export default function Links() {
  const { categories } = useSettingsCategories(LINK_CATEGORIES_TITLE);
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

  const handleTitleClick = (link) => {
    setSelectedLink(link);
    setShowActionModal(true);
  };

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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  const handleAddLink = async (e) => {
    e.preventDefault();
    const title = sanitizeText(formData.title, 200);
    if (!title) { showAlert("❌ יש להזין כותרת", "error"); return; }
    if (!formData.category) { showAlert("❌ יש לבחור קטגוריה", "error"); return; }
    const urlErr = validateUrl(formData.url);
    if (urlErr) { showAlert(`❌ ${urlErr}`, "error"); return; }
    const url = normalizeUrl(formData.url);
    try {
      await addLink({
        title,
        url: url,
        category: formData.category,
        description: sanitizeText(formData.description, 500),
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

  const handleUpdateLink = async (e) => {
    e.preventDefault();
    const title = sanitizeText(formData.title, 200);
    if (!title) { showAlert("❌ יש להזין כותרת", "error"); return; }
    if (!formData.category) { showAlert("❌ יש לבחור קטגוריה", "error"); return; }
    const urlErr = validateUrl(formData.url);
    if (urlErr) { showAlert(`❌ ${urlErr}`, "error"); return; }
    const url = normalizeUrl(formData.url);
    try {
      await updateLink(editingLink.id, {
        title,
        url: url,
        category: formData.category,
        description: sanitizeText(formData.description, 500),
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

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingLink(null);
    setFormData({ title: "", url: "", category: "", description: "" });
  };

  return (
    <AdminPageLayout heroImage="/admin-heroes/links_hero.webp"
      title="מאגר קישורים"
      subtitle="קישורים חשובים ונגישים לצוות"
      actions={
        <button onClick={() => setShowForm(true)} style={{ backgroundColor: "#8B0000", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          + הוספת קישור
        </button>
      }
    >
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
              options: ["הכל", ...categories],
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
                      textDecoration: "none",
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

      {/* مربع الخيارات - مطابق تماماً لتصميم المتطوعين */}
      {showActionModal && selectedLink && (
        <div className="modal-backdrop" onClick={() => setShowActionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxWidth: "90%", borderRadius: "16px" }}>
            <div className="modal-header">
              <h2>{selectedLink.title}</h2>
              <button className="modal-close" onClick={() => setShowActionModal(false)}>
                ×
              </button>
            </div>

            <div className="form-section">
              <div className="section-card-header" style={{ marginBottom: 12 }}>
                <h4>פרטי הקישור</h4>
                <button className="btn btn-primary" onClick={handleEditFromModal}>
                  עריכת פרטים
                </button>
              </div>

              <div className="detail-grid">
                <div className="item">
                  <label>שם הקישור</label>
                  <div>{selectedLink.title}</div>
                </div>
                <div className="item">
                  <label>קטגוריה</label>
                  <div>{selectedLink.category}</div>
                </div>
                <div className="item" style={{ gridColumn: "span 2" }}>
                  <label>קישור</label>
                  <div>
                    <a
                      href={selectedLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-burgundy)", textDecoration: "none", wordBreak: "break-all" }}
                    >
                      {selectedLink.url}
                    </a>
                  </div>
                </div>
                <div className="item" style={{ gridColumn: "span 2" }}>
                  <label>תיאור</label>
                  <div>{selectedLink.description || "—"}</div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowActionModal(false)}>
                סגירה
              </button>
              <button className="btn btn-danger" onClick={handleDeleteFromModal}>
                מחיקת קישור
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
          <div style={{ backgroundColor: "white", borderRadius: "16px", padding: "24px", width: "500px", maxWidth: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>{editingLink ? "עריכת קישור" : "הוספת קישור חדש"}</h2>
              <button onClick={handleCloseForm} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={editingLink ? handleUpdateLink : handleAddLink}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>כותרת *</label>
                <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "8px" }} />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>קישור (URL) *</label>
                <input type="text" required value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "8px" }} />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>קטגוריה *</label>
                <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "8px" }}>
                  <option value="">בחר קטגוריה...</option>
                  {[
                    ...categories,
                    ...(formData.category && !categories.includes(formData.category)
                      ? [formData.category]
                      : []),
                  ].map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>תיאור</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "8px", minHeight: "80px" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
                <button type="button" onClick={handleCloseForm} style={{ padding: "8px 16px", backgroundColor: "#ccc", border: "none", borderRadius: "8px", cursor: "pointer" }}>ביטול</button>
                <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#8B0000", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>{editingLink ? "עדכן" : "שמור"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
