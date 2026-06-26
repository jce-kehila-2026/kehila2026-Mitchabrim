// src/admin/Media.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import {
  getImagesByFolder,
  getFolders,
  getFolderById,
  createFolder,
  deleteFolder,
  uploadImage,
  updateImage,
  deleteImage,
  toggleImagePublic,
  moveImage,
  searchMedia,
  getAllFolders,
  migrateOldImages,
  createDefaultFolders,
} from "@/services/mediaService";

// ─── helpers ────────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("he-IL", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ─── sub-components ──────────────────────────────────────────────────────────

/** Small badge shown on every image card */
function PublicBadge({ isPublic }) {
  return (
    <span
      style={{
        fontSize: "10px",
        background: isPublic ? "#d4edda" : "#f8d7da",
        color: isPublic ? "#155724" : "#721c24",
        padding: "2px 8px",
        borderRadius: "10px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {isPublic ? "🌐 ציבורי" : "🔒 פרטי"}
    </span>
  );
}

/** Tooltip-style info overlay on hover */
function ImageInfoOverlay({ image }) {
  return (
    <div className="mb-img-info-overlay">
      <div className="mb-img-info-row">
        <span className="mb-img-info-label">שם:</span>
        <span className="mb-img-info-val">{image.name}</span>
      </div>
      <div className="mb-img-info-row">
        <span className="mb-img-info-label">נתיב:</span>
        <span className="mb-img-info-val mb-img-path">{image.path || "/"}</span>
      </div>
      <div className="mb-img-info-row">
        <span className="mb-img-info-label">תאריך:</span>
        <span className="mb-img-info-val">{image.displayDate || formatDate(image.createdAt) || "—"}</span>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Media() {
  // ── navigation ──
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath]       = useState([]);

  // ── data ──
  const [folders, setFolders] = useState([]);
  const [images,  setImages]  = useState([]);
  const [loading, setLoading] = useState(true);

  // ── search ──
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching,   setIsSearching]   = useState(false);

  // ── filters ──
  const [filterType,   setFilterType]   = useState("all");   // all | folder | image
  const [filterFrom,   setFilterFrom]   = useState("");       // YYYY-MM-DD
  const [filterTo,     setFilterTo]     = useState("");
  const [filterFolder, setFilterFolder] = useState("");       // folder id
  const [allFoldersList, setAllFoldersList] = useState([]);
  const [showFilters,    setShowFilters]    = useState(false);

  // ── modals ──
  const [showCreateFolder,  setShowCreateFolder]  = useState(false);
  const [showUploadImage,   setShowUploadImage]   = useState(false);
  const [showImageDetails,  setShowImageDetails]  = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showMoveModal,     setShowMoveModal]     = useState(null);

  // ── upload form ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview,  setFilePreview]  = useState(null);
  const [uploadForm,   setUploadForm]   = useState({ name: "", notes: "", isPublic: true });
  const [isUploading,  setIsUploading]  = useState(false);

  // ── folder form ──
  const [folderForm,       setFolderForm]       = useState({ name: "" });
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // ── toast ──
  const [toast, setToast] = useState({ message: "", type: "" });

  const fileInputRef = useRef(null);

  // ════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ════════════════════════════════════════════════════════════════════════════
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersData, imagesData, allFolders] = await Promise.all([
        getFolders(currentFolder?.id || null),
        getImagesByFolder(currentFolder?.id || null),
        getAllFolders(),
      ]);
      setFolders(foldersData);
      setImages(imagesData);
      setAllFoldersList(allFolders);
    } catch (err) {
      console.error("Error loading data:", err);
      showToast("שגיאה בטעינת הנתונים", "error");
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  useEffect(() => { loadData(); }, [loadData]);

  // breadcrumb
  useEffect(() => {
    (async () => {
      if (!currentFolder) { setFolderPath([]); return; }
      const path = [];
      let cur = currentFolder;
      while (cur) {
        path.unshift(cur);
        cur = cur.parentId ? await getFolderById(cur.parentId) : null;
      }
      setFolderPath(path);
    })();
  }, [currentFolder]);

  // ════════════════════════════════════════════════════════════════════════════
  // TOAST
  // ════════════════════════════════════════════════════════════════════════════
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ════════════════════════════════════════════════════════════════════════════
  const navigateToFolder = (folder) => {
    setCurrentFolder(folder);
    resetSearch();
  };
  const navigateToRoot = () => {
    setCurrentFolder(null);
    resetSearch();
  };
  const resetSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ════════════════════════════════════════════════════════════════════════════
  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    try {
      const results = await searchMedia(q);
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // FILTER LOGIC
  // ════════════════════════════════════════════════════════════════════════════
  const applyFilters = (items) => {
    return items.filter((item) => {
      // type filter
      if (filterType === "folder" && item.type !== "folder") return false;
      if (filterType === "image"  && item.type === "folder") return false;

      // folder filter (only for images)
      if (filterFolder && item.type !== "folder") {
        if (item.parentId !== filterFolder) return false;
      }

      // date filter (only for images)
      if (item.type !== "folder") {
        const raw = item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt ? new Date(item.createdAt) : null;
        if (filterFrom && raw && raw < new Date(filterFrom)) return false;
        if (filterTo   && raw && raw > new Date(filterTo + "T23:59:59")) return false;
      }

      return true;
    });
  };

  const hasActiveFilters = filterType !== "all" || filterFrom || filterTo || filterFolder;

  const clearFilters = () => {
    setFilterType("all");
    setFilterFrom("");
    setFilterTo("");
    setFilterFolder("");
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE FOLDER
  // ════════════════════════════════════════════════════════════════════════════
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderForm.name.trim()) { showToast("יש להזין שם למחלקה", "error"); return; }
    setIsCreatingFolder(true);
    try {
      const parentPath = currentFolder?.path || "";
      await createFolder({
        name: folderForm.name.trim(),
        parentId: currentFolder?.id || null,
        path: parentPath ? `${parentPath}/${folderForm.name.trim()}` : `/${folderForm.name.trim()}`,
      });
      showToast(`המחלקה "${folderForm.name}" נוצרה`, "success");
      setFolderForm({ name: "" });
      setShowCreateFolder(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה ביצירת המחלקה", "error");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // UPLOAD IMAGE
  // ════════════════════════════════════════════════════════════════════════════
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result);
    reader.readAsDataURL(file);
    setUploadForm((prev) => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, "") }));
  };

  const handleUploadImage = async (e) => {
    e.preventDefault();
    if (!selectedFile)          { showToast("יש לבחור קובץ", "error"); return; }
    if (!uploadForm.name.trim()) { showToast("יש להזין שם", "error"); return; }
    setIsUploading(true);
    try {
      await uploadImage(selectedFile, {
        name:       uploadForm.name.trim(),
        notes:      uploadForm.notes.trim(),
        parentId:   currentFolder?.id || null,
        path:       currentFolder?.path || "/",
        isPublic:   uploadForm.isPublic,
        folderName: currentFolder?.name || "",
      });
      showToast(`"${uploadForm.name}" הועלתה`, "success");
      setSelectedFile(null);
      setFilePreview(null);
      setUploadForm({ name: "", notes: "", isPublic: true });
      setShowUploadImage(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה בהעלאת התמונה", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════════════════════════════════
  const handleDeleteImage = async (image) => {
    try {
      await deleteImage(image.id, image.url);
      showToast(`"${image.name}" נמחקה`, "success");
      setShowDeleteConfirm(null);
      setShowImageDetails(null);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה במחיקה", "error");
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!confirm(`למחוק את "${folder.name}" וכל תוכנה?`)) return;
    try {
      await deleteFolder(folder.id);
      showToast(`"${folder.name}" נמחקה`, "success");
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה במחיקה", "error");
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // TOGGLE PUBLIC  ← "העברה לאתר ציבורי"
  // ════════════════════════════════════════════════════════════════════════════
  const handleTogglePublic = async (image) => {
    try {
      const next = !image.isPublic;
      await toggleImagePublic(image.id, next);
      showToast(next ? "התמונה פורסמה באתר הציבורי ✅" : "התמונה הוסרה מהאתר הציבורי", "success");
      // update local state so details modal reflects change immediately
      if (showImageDetails?.id === image.id) {
        setShowImageDetails((prev) => ({ ...prev, isPublic: next }));
      }
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה בעדכון הסטטוס", "error");
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // UPDATE IMAGE DETAILS
  // ════════════════════════════════════════════════════════════════════════════
  const handleUpdateImage = async (imageId, updates) => {
    try {
      await updateImage(imageId, updates);
      showToast("הפרטים עודכנו", "success");
      setShowImageDetails(null);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה בעדכון", "error");
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // MOVE IMAGE
  // ════════════════════════════════════════════════════════════════════════════
  const handleMoveImage = async (imageId, targetFolderId) => {
    try {
      await moveImage(imageId, targetFolderId);
      showToast("התמונה הועברה", "success");
      setShowMoveModal(null);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("שגיאה בהעברה", "error");
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // MIGRATION HELPERS
  // ════════════════════════════════════════════════════════════════════════════
  const handleMigrate = async () => {
    if (!confirm("להמיר תמונות ישנות?")) return;
    try {
      const r = await migrateOldImages();
      showToast(r.success ? `${r.count} תמונות הומרו` : "שגיאה", r.success ? "success" : "error");
      if (r.success) await loadData();
    } catch (err) { showToast("שגיאה", "error"); }
  };

  const handleCreateDefaultFolders = async () => {
    if (!confirm("ליצור מחלקות ברירת מחדל?")) return;
    try {
      const created = await createDefaultFolders();
      showToast(`${created.length} מחלקות נוצרו`, "success");
      await loadData();
    } catch (err) { showToast("שגיאה", "error"); }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DERIVED DISPLAY LIST
  // ════════════════════════════════════════════════════════════════════════════
  const rawItems    = isSearching ? searchResults : [...folders, ...images];
  const displayItems = applyFilters(rawItems);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <AdminLayout
      title="מאגר תמונות"
      subtitle="ניהול תמונות ומחלקות"
      actions={
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => setShowCreateFolder(true)}>
            + מחלקה חדשה
          </button>
          <button className="btn btn-primary" onClick={() => setShowUploadImage(true)}>
            📷 העלאת תמונה
          </button>
          <button className="btn" onClick={handleCreateDefaultFolders} style={{ fontSize: "12px" }}>
            מחלקות ברירת מחדל
          </button>
          <button className="btn" onClick={handleMigrate} style={{ fontSize: "12px" }}>
            המרת תמונות ישנות
          </button>
        </div>
      }
    >
      {/* ── TOAST ── */}
      {toast.message && (
        <div className={`admin-toast ${toast.type === "error" ? "error" : ""}`}>
          {toast.message}
        </div>
      )}

      {/* ── BREADCRUMB ── */}
      <div className="mb-breadcrumb">
        <button className="btn btn-ghost mb-breadcrumb-btn" onClick={navigateToRoot}>
          🏠 ראשי
        </button>
        {folderPath.map((folder, i) => (
          <span key={folder.id} className="mb-breadcrumb-seg">
            <span className="mb-breadcrumb-sep">/</span>
            <button
              className="btn btn-ghost mb-breadcrumb-btn"
              onClick={() => navigateToFolder(folder)}
              style={{ fontWeight: i === folderPath.length - 1 ? 700 : 400 }}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      {/* ── SEARCH + FILTERS ── */}
      <SectionCard>
        <div className="mb-search-row">
          <div className="mb-search-wrap">
            <span className="mb-search-icon">🔍</span>
            <input
              type="text"
              className="input mb-search-input"
              placeholder="חיפוש לפי שם, הערות, נתיב..."
              value={searchQuery}
              onChange={handleSearch}
            />
            {searchQuery && (
              <button className="mb-search-clear" onClick={resetSearch}>×</button>
            )}
          </div>

          <button
            className={`btn ${showFilters || hasActiveFilters ? "btn-primary" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            🎛 פילטרים {hasActiveFilters && `(${[filterType !== "all", filterFrom, filterTo, filterFolder].filter(Boolean).length})`}
          </button>

          {isSearching && (
            <span className="mb-search-count">
              {displayItems.length} תוצאות
            </span>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-filter-panel">
            <div className="mb-filter-group">
              <label className="mb-filter-label">סוג פריט</label>
              <div className="mb-filter-pills">
                {[["all", "הכל"], ["folder", "📁 מחלקות"], ["image", "🖼 תמונות"]].map(([v, l]) => (
                  <button
                    key={v}
                    className={`mb-filter-pill ${filterType === v ? "active" : ""}`}
                    onClick={() => setFilterType(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-filter-group">
              <label className="mb-filter-label">תאריך העלאה</label>
              <div className="mb-filter-dates">
                <input
                  type="date"
                  className="input"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  placeholder="מתאריך"
                />
                <span style={{ color: "#888" }}>עד</span>
                <input
                  type="date"
                  className="input"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  placeholder="עד תאריך"
                />
              </div>
            </div>

            {isSearching && (
              <div className="mb-filter-group">
                <label className="mb-filter-label">חפש בתוך מחלקה</label>
                <select
                  className="input"
                  value={filterFolder}
                  onChange={(e) => setFilterFolder(e.target.value)}
                >
                  <option value="">כל המחלקות</option>
                  {allFoldersList.map((f) => (
                    <option key={f.id} value={f.id}>{f.path || f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button className="btn mb-filter-clear" onClick={clearFilters}>
                ✕ נקה פילטרים
              </button>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── GRID ── */}
      <SectionCard>
        {loading ? (
          <div className="mb-empty">
            <div className="loader" />
            <p>טוען...</p>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="mb-empty">
            <span style={{ fontSize: "48px" }}>📁</span>
            <p>{isSearching ? "לא נמצאו תוצאות" : "אין פריטים במחלקה זו"}</p>
            {!isSearching && (
              <button className="btn btn-primary" onClick={() => setShowUploadImage(true)}>
                📷 העלאת תמונה
              </button>
            )}
          </div>
        ) : (
          <div className="mb-grid">
            {displayItems.map((item) =>
              item.type === "folder"
                ? <FolderCard key={item.id} folder={item} onOpen={navigateToFolder} onDelete={handleDeleteFolder} />
                : <ImageCard key={item.id} image={item} onOpen={setShowImageDetails} onDelete={setShowDeleteConfirm} onTogglePublic={handleTogglePublic} />
            )}
          </div>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* CREATE FOLDER */}
      {showCreateFolder && (
        <Modal onClose={() => setShowCreateFolder(false)} title="📁 מחלקה חדשה" maxWidth="480px">
          <form onSubmit={handleCreateFolder}>
            <div className="form-section">
              <div className="field">
                <label>שם המחלקה *</label>
                <input
                  className="input"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ name: e.target.value })}
                  placeholder="לדוגמה: פעילויות 2024"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>מיקום</label>
                <div style={{ color: "#666", fontSize: "14px", padding: "8px 0" }}>
                  📍 {currentFolder ? folderPath.map((f) => f.name).join(" / ") : "ראשי"}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowCreateFolder(false)}>ביטול</button>
              <button type="submit" className="btn btn-primary" disabled={isCreatingFolder}>
                {isCreatingFolder ? "יוצר..." : "יצירת מחלקה"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* UPLOAD IMAGE */}
      {showUploadImage && (
        <Modal onClose={() => setShowUploadImage(false)} title="📷 העלאת תמונה" maxWidth="560px">
          <form onSubmit={handleUploadImage}>
            <div className="form-section">
              <div className="field">
                <label>בחר קובץ *</label>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="input" />
                {filePreview && (
                  <img src={filePreview} alt="preview" className="mb-upload-preview" />
                )}
              </div>
              <div className="field">
                <label>שם התמונה *</label>
                <input
                  className="input"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder="שם התמונה"
                />
              </div>
              <div className="field">
                <label>הערות</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  placeholder="תיאור התמונה"
                />
              </div>
              <div className="field mb-toggle-row">
                <label>🌐 הצג באתר הציבורי</label>
                <button
                  type="button"
                  className={`mb-toggle-btn ${uploadForm.isPublic ? "active" : ""}`}
                  onClick={() => setUploadForm({ ...uploadForm, isPublic: !uploadForm.isPublic })}
                >
                  {uploadForm.isPublic ? "כן" : "לא"}
                </button>
              </div>
              <div className="field">
                <label>מיקום</label>
                <div style={{ color: "#666", fontSize: "14px", padding: "8px 0" }}>
                  📍 {currentFolder ? folderPath.map((f) => f.name).join(" / ") : "ראשי"}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowUploadImage(false)}>ביטול</button>
              <button type="submit" className="btn btn-primary" disabled={isUploading}>
                {isUploading ? "מעלה..." : "העלאת תמונה"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* IMAGE DETAILS */}
      {showImageDetails && (
        <ImageDetailsModal
          image={showImageDetails}
          allFolders={allFoldersList}
          onClose={() => setShowImageDetails(null)}
          onChange={(upd) => setShowImageDetails((p) => ({ ...p, ...upd }))}
          onSave={() =>
            handleUpdateImage(showImageDetails.id, {
              name:     showImageDetails.name,
              notes:    showImageDetails.notes,
              isPublic: showImageDetails.isPublic,
            })
          }
          onDelete={() => setShowDeleteConfirm(showImageDetails)}
          onTogglePublic={() => handleTogglePublic(showImageDetails)}
          onMove={(targetId) => handleMoveImage(showImageDetails.id, targetId)}
        />
      )}

      {/* DELETE CONFIRM */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(null)} title="⚠️ מחיקת תמונה" maxWidth="400px">
          <div className="form-section" style={{ textAlign: "center" }}>
            <p>האם למחוק את התמונה</p>
            <p style={{ fontWeight: "bold", color: "#8B0000", fontSize: "16px" }}>
              "{showDeleteConfirm.name}"?
            </p>
            <p style={{ color: "#888", fontSize: "13px" }}>פעולה זו אינה ניתנת לביטול</p>
          </div>
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button className="btn" onClick={() => setShowDeleteConfirm(null)}>ביטול</button>
            <button className="btn btn-danger" onClick={() => handleDeleteImage(showDeleteConfirm)}>
              מחק לצמיתות
            </button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

// ─── FOLDER CARD ─────────────────────────────────────────────────────────────
function FolderCard({ folder, onOpen, onDelete }) {
  return (
    <div className="mb-card mb-card-folder" onClick={() => onOpen(folder)}>
      <div className="mb-card-thumb mb-card-folder-thumb">
        <span className="mb-folder-icon">📁</span>
      </div>
      <div className="mb-card-body">
        <div className="mb-card-name">{folder.name}</div>
        <div className="mb-card-meta">מחלקה</div>
        {folder.path && (
          <div className="mb-card-path" title={folder.path}>{folder.path}</div>
        )}
      </div>
      <button
        className="mb-card-del"
        onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
        title="מחק מחלקה"
      >
        ×
      </button>
    </div>
  );
}

// ─── IMAGE CARD ───────────────────────────────────────────────────────────────
function ImageCard({ image, onOpen, onDelete, onTogglePublic }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="mb-card mb-card-image"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* thumbnail */}
      <div
        className="mb-card-thumb mb-card-image-thumb"
        style={{ backgroundImage: `url(${image.url})` }}
        onClick={() => onOpen(image)}
      >
        {/* hover overlay with path/date info */}
        {hovered && <ImageInfoOverlay image={image} />}
      </div>

      <div className="mb-card-body">
        <div className="mb-card-name" title={image.name}>{image.name}</div>
        <div className="mb-card-footer">
          <PublicBadge isPublic={image.isPublic} />
          <span className="mb-card-date">{image.displayDate || formatDate(image.createdAt)}</span>
        </div>

        {/* quick "publish to site" button */}
        <button
          className={`mb-publish-btn ${image.isPublic ? "published" : ""}`}
          onClick={() => onTogglePublic(image)}
          title={image.isPublic ? "הסר מהאתר הציבורי" : "הוסף לאתר הציבורי"}
        >
          {image.isPublic ? "✓ מופיע באתר" : "➕ הוסף לאתר"}
        </button>
      </div>

      {/* delete button */}
      <button
        className="mb-card-del"
        onClick={(e) => { e.stopPropagation(); onDelete(image); }}
        title="מחק תמונה"
      >
        ×
      </button>
    </div>
  );
}

// ─── IMAGE DETAILS MODAL ─────────────────────────────────────────────────────
function ImageDetailsModal({ image, allFolders, onClose, onChange, onSave, onDelete, onTogglePublic, onMove }) {
  const [targetFolder, setTargetFolder] = useState("");
  const [showMoveSection, setShowMoveSection] = useState(false);

  return (
    <Modal onClose={onClose} title="🖼️ פרטי תמונה" maxWidth="740px">
      <div className="form-section">
        {/* image preview */}
        <div className="mb-details-preview-wrap">
          <img src={image.url} alt={image.name} className="mb-details-preview" />
        </div>

        {/* info grid */}
        <div className="mb-details-info-grid">
          <div className="mb-details-info-item">
            <span className="mb-details-info-label">📍 נתיב</span>
            <span className="mb-details-info-val mb-details-path">{image.path || "/"}</span>
          </div>
          <div className="mb-details-info-item">
            <span className="mb-details-info-label">📅 תאריך</span>
            <span className="mb-details-info-val">{image.displayDate || formatDate(image.createdAt)}</span>
          </div>
          <div className="mb-details-info-item">
            <span className="mb-details-info-label">📁 מחלקה</span>
            <span className="mb-details-info-val">{image.folderName || "ראשי"}</span>
          </div>
          <div className="mb-details-info-item">
            <span className="mb-details-info-label">🌐 סטטוס</span>
            <PublicBadge isPublic={image.isPublic} />
          </div>
        </div>

        {/* editable fields */}
        <div className="field">
          <label>שם התמונה</label>
          <input
            className="input"
            value={image.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>הערות</label>
          <textarea
            className="textarea"
            rows={3}
            value={image.notes || ""}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>

        {/* publish toggle — prominent */}
        <div className="mb-details-publish-row">
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>הצגה באתר הציבורי</div>
            <div style={{ fontSize: 13, color: "#666" }}>
              תמונות ציבוריות מופיעות בגלריה הציבורית (/gallery)
            </div>
          </div>
          <button
            className={`mb-toggle-btn ${image.isPublic ? "active" : ""}`}
            onClick={onTogglePublic}
            style={{ minWidth: 80 }}
          >
            {image.isPublic ? "✅ ציבורי" : "🔒 פרטי"}
          </button>
        </div>

        {/* move to folder */}
        <div className="mb-details-move-section">
          <button
            className="btn"
            onClick={() => setShowMoveSection((v) => !v)}
            style={{ fontSize: 13 }}
          >
            📦 העבר למחלקה אחרת
          </button>
          {showMoveSection && (
            <div className="mb-details-move-row">
              <select
                className="input"
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
              >
                <option value="">בחר מחלקה...</option>
                {allFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.path || f.name}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={() => { if (targetFolder) onMove(targetFolder); }}
                disabled={!targetFolder}
              >
                העבר
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-danger" onClick={onDelete}>מחק תמונה</button>
        <button className="btn" onClick={onClose}>סגור</button>
        <button className="btn btn-primary" onClick={onSave}>שמור שינויים</button>
      </div>
    </Modal>
  );
}

// ─── GENERIC MODAL WRAPPER ────────────────────────────────────────────────────
function Modal({ onClose, title, maxWidth = "560px", children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}