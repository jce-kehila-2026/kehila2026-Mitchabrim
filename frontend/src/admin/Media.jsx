import { useState, useRef, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

// Import Firebase tools
import { storage, db } from "../firebase"; 
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, getDocs, doc, deleteDoc, serverTimestamp } from "firebase/firestore";

const CATEGORIES = ["פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"];

export default function Media() {
  const [imagesList, setImagesList] = useState([]);
  const fileInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(""); 
  const [dateSort, setDateSort] = useState("newest"); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); 
  const [filePreview, setFilePreview] = useState(null); 

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    notes: ""
  });

  // --- New Logic 1: States for Custom Alerts & Confirmations ---
  // Toast Notification State
  const [toastMessage, setToastMessage] = useState(""); 
  
  // Custom Delete Confirm Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, image: null });

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "images"));
        const fetchedImages = [];
        querySnapshot.forEach((doc) => {
          fetchedImages.push({ id: doc.id, ...doc.data() });
        });
        setImagesList(fetchedImages);
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };
    fetchImages();
  }, []);

  // Helper function to show modern toast notification instead of alert()
  const showToast = (message) => {
    setToastMessage(message);
    // Auto-hide the toast after 3.5 seconds
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleOpenModal = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFormData({ title: "", category: "", notes: "" });
    setIsModalOpen(true);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    setFormData(prev => ({...prev, title: file.name.split('.').pop() ? file.name.replace(/\.[^/.]+$/, "") : file.name}));
  };

  const handleFinalUpload = async () => {
    // We still use simple alerts for basic form validation as it's quick, 
    // but you can replace these with showToast("...") if you prefer!
    if (!selectedFile) { showToast("אנא בחר קובץ תמונה"); return; }
    if (!formData.title.trim()) { showToast("אנא הזן שם לתמונה"); return; }
    if (!formData.category) { showToast("אנא בחר קטגוריה"); return; }

    setIsUploading(true);

    try {
      const imageRef = ref(storage, `images/${Date.now()}_${selectedFile.name}`); 
      await uploadBytes(imageRef, selectedFile);
      const url = await getDownloadURL(imageRef);

      const todayDate = new Date().toLocaleDateString('he-IL');

      const newImageDoc = {
        title: formData.title.trim(),
        category: formData.category, 
        notes: formData.notes.trim(),
        url: url,
        uploadedAt: serverTimestamp(), 
        displayDate: todayDate 
      };

      const docRef = await addDoc(collection(db, "images"), newImageDoc);
      setImagesList((prevList) => [...prevList, { id: docRef.id, ...newImageDoc }]);
      
      // Replaced alert() with our custom elegant toast
      showToast("התמונה הועלתה ונשמרה בהצלחה!"); 
      setIsModalOpen(false); 

    } catch (error) {
      console.error("Error during upload:", error);
      showToast("אירעה שגיאה בזמן ההעלאה. אנא נסה שוב.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- New Logic 2: Trigger custom confirm modal instead of window.confirm ---
  const triggerDeleteConfirm = (img) => {
    setDeleteConfirm({ isOpen: true, image: img });
  };

  // --- New Logic 3: Execute actual delete when user clicks "Yes" in custom modal ---
  const executeDelete = async () => {
    const imageToDelete = deleteConfirm.image;
    if (!imageToDelete) return;

    try {
      await deleteDoc(doc(db, "images", imageToDelete.id));
      const imageStorageRef = ref(storage, imageToDelete.url);
      await deleteObject(imageStorageRef);
      setImagesList((prevList) => prevList.filter((img) => img.id !== imageToDelete.id));
      
      showToast("התמונה נמחקה בהצלחה!");
    } catch (error) {
      console.error("Error deleting image:", error);
      showToast("שגיאה במחיקת התמונה.");
    } finally {
      // Close the confirm modal and clear its memory
      setDeleteConfirm({ isOpen: false, image: null });
    }
  };

  const parseDate = (dateString) => {
    if (!dateString) return 0;
    const [day, month, year] = dateString.split('.');
    return new Date(`${year}-${month}-${day}`).getTime();
  };

  const displayedImages = imagesList
    .filter((img) => {
      const matchesSearch = img.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "" || img.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (dateSort === "newest") {
        return parseDate(b.displayDate) - parseDate(a.displayDate);
      } else {
        return parseDate(a.displayDate) - parseDate(b.displayDate);
      }
    });

  const inputStyle = { 
    width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #ced4da", outline: "none", fontFamily: "inherit", direction: "rtl", fontSize: "14px"
  };

  return (
    <AdminLayout
      title="מאגר תמונות"
      subtitle="ניהול תמונות לפי נושאים"
      actions={
        <>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            + העלאת תמונה
          </button>
        </>
      }
    >
      {/* --- New UI: Elegant Toast Notification (Shows conditionally) --- */}
      {toastMessage && (
        <div style={{
          position: "fixed", top: "30px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#fff", color: "#495057", padding: "12px 24px",
          borderRadius: "8px", boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
          borderRight: "4px solid #8b2c2c", zIndex: 2000, fontWeight: "bold",
          animation: "fadeInDown 0.3s ease-out", direction: "rtl", display: "flex", alignItems: "center", gap: "10px"
        }}>
          <span style={{ color: "#8b2c2c", fontSize: "18px" }}>✓</span>
          {toastMessage}
        </div>
      )}

      <SectionCard>
        
        <div style={{ backgroundColor: "#faf8f5", padding: "16px", borderRadius: "8px", border: "1px solid #e9ecef", marginBottom: "24px", direction: "rtl" }}>
          
          <div style={{ marginBottom: "16px", position: "relative" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6c757d" }}>🔍</span>
            <input
              type="text"
              placeholder="חיפוש תמונה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              dir="rtl"
              style={{ ...inputStyle, padding: "10px 12px 10px 35px", borderRadius: "20px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "20px", flexWrap: "wrap" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#8b2c2c", fontWeight: "bold", fontSize: "15px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                סינון:
              </span>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} dir="rtl" style={{ ...inputStyle, padding: "8px 16px", borderRadius: "20px", minWidth: "140px" }}>
                <option value="">קטגוריה: הכל</option>
                {CATEGORIES.map((category) => (<option key={category} value={category}>{category}</option>))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span style={{ color: "#8b2c2c", fontWeight: "bold", fontSize: "15px" }}>מיון לפי:</span>
              <select value={dateSort} onChange={(e) => setDateSort(e.target.value)} dir="rtl" style={{ ...inputStyle, padding: "8px 16px", borderRadius: "20px", minWidth: "140px" }}>
                <option value="newest">החדש ביותר</option>
                <option value="oldest">הישן ביותר</option>
              </select>
            </div>

          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, direction: "rtl" }}>
          {displayedImages.map((img) => (
            <div key={img.id} className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
              {/* Note: changed onClick to trigger our custom modal instead of direct delete function */}
              <button onClick={() => triggerDeleteConfirm(img)} style={{ position: "absolute", top: 8, left: 8, background: "rgba(220, 53, 69, 0.9)", color: "white", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", zIndex: 5 }}>🗑️</button>
              <div style={{ aspectRatio: "4/3", backgroundImage: `url(${img.url})`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#f6ecdc" }}></div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700 }} title={img.title}>{img.title.length > 20 ? img.title.substring(0, 20) + "..." : img.title}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{img.category} • {img.displayDate}</div>
                {img.notes && (
                  <div style={{ fontSize: 11, color: "#6c757d", marginTop: 6, fontStyle: "italic", borderTop: "1px solid #eee", paddingTop: "4px" }}>
                    {img.notes.length > 50 ? img.notes.substring(0, 50) + "..." : img.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
          {displayedImages.length === 0 && (<div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "#6c757d" }}>לא נמצאו תמונות התואמות לחיפוש שלך.</div>)}
        </div>
      </SectionCard>

      {/* Upload Modal (Remains the same as previous) */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "480px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", position: "relative" }}>
            <button style={{ position: "absolute", top: "15px", left: "15px", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }} onClick={() => !isUploading && setIsModalOpen(false)}>✕</button>
            <h3 style={{ margin: "0 0 16px 0", color: "#8b2c2c", textAlign: "center", fontWeight: "bold", fontSize: "1.3rem" }}>פרטי תמונה חדשה</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                {filePreview ? (
                  <img src={filePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "110px", objectFit: "cover", borderRadius: "8px", border: "1px solid #ddd", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
                ) : (
                  <div style={{ height: "80px", width: "100%", border: "2px dashed #ced4da", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#6c757d", backgroundColor: "#fafafa" }}>טרם נבחרה תמונה</div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{ display: "none" }} />
                <button className="btn btn-outline-primary" style={{ fontSize: "12px", backgroundColor: "#f8f9fa", border: "1px solid #ced4da", color: "#495057", padding: "4px 16px", borderRadius: "20px", cursor: "pointer" }} onClick={() => fileInputRef.current.click()}>{selectedFile ? "שנה תמונה" : "בחר תמונה *"}</button>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "13px", color: "#495057" }}>שם התמונה *</label>
                <input type="text" placeholder="לדוגמה: יום התנדבות בשדרות" value={formData.title} onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "13px", color: "#495057" }}>קטגוריה *</label>
                <select value={formData.category} onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))} style={inputStyle}>
                  <option value="">בחר קטגוריה</option>
                  {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "13px", color: "#495057" }}>הערות / תיאור</label>
                <textarea placeholder="פרטים נוספים על התמונה..." value={formData.notes} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))} rows="2" style={{ ...inputStyle, resize: "none" }}></textarea>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <button style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "white", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: isUploading ? "not-allowed" : "pointer" }} onClick={() => setIsModalOpen(false)} disabled={isUploading}>ביטול</button>
                <button className="btn btn-primary" style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.7 : 1 }} onClick={handleFinalUpload} disabled={isUploading}>{isUploading ? "מעלה..." : "שמור ופרסם"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- New UI: Custom Elegant Delete Confirmation Modal --- */}
      {deleteConfirm.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "400px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", textAlign: "center" }}>
            
            {/* Warning Icon */}
            <div style={{ backgroundColor: "#f8d7da", color: "#dc3545", width: "50px", height: "50px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 16px auto" }}>
              🗑️
            </div>
            
            <h3 style={{ margin: "0 0 10px 0", color: "#343a40", fontWeight: "bold", fontSize: "1.2rem" }}>מחיקת תמונה</h3>
            <p style={{ color: "#6c757d", marginBottom: "20px", fontSize: "15px" }}>
              האם אתה בטוח שברצונך למחוק את התמונה <strong>"{deleteConfirm.image?.title}"</strong>?<br/>
              פעולה זו אינה ניתנת לביטול.
            </p>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                style={{ padding: "8px 24px", borderRadius: "8px", backgroundColor: "white", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: "pointer" }} 
                onClick={() => setDeleteConfirm({ isOpen: false, image: null })}
              >
                ביטול
              </button>
              <button 
                style={{ padding: "8px 24px", borderRadius: "8px", backgroundColor: "#dc3545", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }} 
                onClick={executeDelete}
              >
                כן, מחק תמונה
              </button>
            </div>
            
          </div>
        </div>
      )}
    </AdminLayout>
  );
}