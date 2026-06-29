import { useState, useRef, useEffect } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

// Import Firebase tools
import { storage, db } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

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
  notes: "",
  isPublic: false,
});

  const [toastMessage, setToastMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, image: null });

  // State for Image Details/Edit Modal
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, image: null });
  const [isUpdating, setIsUpdating] = useState(false);

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

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleOpenModal = () => {
  setSelectedFile(null);
  setFilePreview(null);
  setFormData({ title: "", category: "", notes: "", isPublic: false });
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

    setFormData((prev) => ({
      ...prev,
      title: file.name.split(".").pop() ? file.name.replace(/\.[^/.]+$/, "") : file.name,
    }));
  };

  const handleFinalUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast("אנא בחר קובץ תמונה");
      return;
    }
    if (!formData.title.trim()) {
      showToast("אנא הזן שם לתמונה");
      return;
    }
    if (!formData.category) {
      showToast("אנא בחר קטגוריה");
      return;
    }

    setIsUploading(true);

    try {
      const imageRef = ref(storage, `images/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(imageRef, selectedFile);
      const url = await getDownloadURL(imageRef);

      const todayDate = new Date().toLocaleDateString("he-IL");

      const newImageDoc = {
  title: formData.title.trim(),
  category: formData.category,
  notes: formData.notes.trim(),
  url: url,
  uploadedAt: serverTimestamp(),
  displayDate: todayDate,
  isPublic: formData.isPublic || false,
};

      const docRef = await addDoc(collection(db, "images"), newImageDoc);
      setImagesList((prevList) => [...prevList, { id: docRef.id, ...newImageDoc }]);

      showToast("התמונה הועלתה ונשמרה בהצלחה!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error during upload:", error);
      showToast("אירעה שגיאה בזמן ההעלאה. אנא נסה שוב.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerDeleteConfirm = (e, img) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, image: img });
  };

  const executeDelete = async () => {
    const imageToDelete = deleteConfirm.image;
    if (!imageToDelete) return;

    try {
      await deleteDoc(doc(db, "images", imageToDelete.id));
      const imageStorageRef = ref(storage, imageToDelete.url);
      await deleteObject(imageStorageRef);

      setImagesList((prevList) => prevList.filter((img) => img.id !== imageToDelete.id));

      if (detailsModal.image && detailsModal.image.id === imageToDelete.id) {
        setDetailsModal({ isOpen: false, image: null });
      }

      showToast("התמונה נמחקה בהצלחה!");
    } catch (error) {
      console.error("Error deleting image:", error);
      showToast("שגיאה במחיקת התמונה.");
    } finally {
      setDeleteConfirm({ isOpen: false, image: null });
    }
  };

  const toggleIsPublic = async (e, img) => {
    e.stopPropagation();
    try {
      const imageRef = doc(db, "images", img.id);
      const newStatus = !img.isPublic;
      await updateDoc(imageRef, { isPublic: newStatus });
      setImagesList((prevList) =>
        prevList.map((item) => (item.id === img.id ? { ...item, isPublic: newStatus } : item))
      );
      showToast(newStatus ? "התמונה צורפה למوقع הציבורי בהצלחה!" : "התמונה הוסרה מהאתר הציבורי בהצלחה!");
    } catch (error) {
      console.error("Error updating image public status:", error);
      showToast("שגיאה בעדכון סטטוס התמונה.");
    }
  };

  const handleOpenDetails = (img) => {
    setDetailsModal({ isOpen: true, image: { ...img } });
  };

  const handleUpdateImageDetails = async () => {
    if (!detailsModal.image) return;
    setIsUpdating(true);
    try {
      const imageRef = doc(db, "images", detailsModal.image.id);

      await updateDoc(imageRef, {
        title: detailsModal.image.title.trim(),
        category: detailsModal.image.category,
        notes: detailsModal.image.notes.trim(),
        isPublic: detailsModal.image.isPublic || false,
      });

      setImagesList((prevList) =>
        prevList.map((img) =>
          img.id === detailsModal.image.id
            ? {
                ...img,
                title: detailsModal.image.title.trim(),
                category: detailsModal.image.category,
                notes: detailsModal.image.notes.trim(),
                isPublic: detailsModal.image.isPublic || false,
              }
            : img,
        ),
      );

      showToast("פרטי התמונה עודכנו בהצלחה!");
    } catch (error) {
      console.error("Error updating image details:", error);
      showToast("שגיאה בעדכון פרטי התמונה.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSeedMockImages = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך להוסיף 35 תמונות לדוגמה (7 לכל קטגוריה) למאגר?")) return;
    
    showToast("מתחיל להוסיף תמונות לדוגמה...");
    let addedCount = 0;
    
    const mock_urls = {
      "פרלמנטים": [
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80"
      ],
      "מתנדבים": [
        "https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=80"
      ],
      "חגים": [
        "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513507804186-01a60f249e47?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507504038482-76210374c27f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512418490979-92798cec1380?w=800&auto=format&fit=crop&q=80"
      ],
      "שיווק": [
        "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1533750516457-a7f992034fec?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80"
      ],
      "כרטיסי ברכה": [
        "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&auto=format&fit=crop&q=80"
      ]
    };

    try {
      const addedDocs = [];
      for (const category of CATEGORIES) {
        const urls = mock_urls[category];
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const today = new Date();
          today.setDate(today.getDate() - i);
          const displayDate = today.toLocaleDateString("he-IL");
          
          const newDoc = {
            title: `${category} - תמונה לדוגמה ${i + 1}`,
            category: category,
            notes: `תמונת תרגול עבור קטגוריית ${category}.`,
            url: url,
            uploadedAt: serverTimestamp(),
            displayDate: displayDate,
            isPublic: true
          };
          
          const docRef = await addDoc(collection(db, "images"), newDoc);
          addedDocs.push({
            id: docRef.id,
            ...newDoc,
            uploadedAt: { seconds: Math.floor(today.getTime() / 1000) }
          });
          addedCount++;
        }
      }
      
      setImagesList((prevList) => [...prevList, ...addedDocs]);
      showToast(`בהצלחה! נוספו ${addedCount} תמונות לדוגמה.`);
    } catch (error) {
      console.error("Error seeding mock images:", error);
      showToast("שגיאה בהוספת תמונות לדוגמה.");
    }
  };

  const parseDate = (dateString) => {
    if (!dateString) return 0;
    const [day, month, year] = dateString.split(".");
    return new Date(`${year}-${month}-${day}`).getTime();
  };

  const displayedImages = imagesList
    .filter((img) => {
      const matchesSearch = (img.title || "").toLowerCase().includes((searchQuery || "").toLowerCase());
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
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    outline: "none",
    fontFamily: "inherit",
    direction: "rtl",
    fontSize: "14px",
  };

  return (
    <AdminPageLayout heroImage="/admin-heroes/gallery_hero.png"
      title="ניהול תמונות"
      subtitle="ניהול תמונות האתר, גלריות ותמונות מוצגות"
      actions={
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="action-btn-primary" onClick={handleOpenModal}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            העלאת תמונה
          </button>
          
          
        </div>
      }
    >
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; transition: background 0.2s; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .modal-form-select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: left 12px center;
            padding-left: 40px !important;
        }

        .image-card-container {
            border-radius: 12px;
            overflow: hidden;
            background: #fff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
            cursor: pointer;
        }
        .image-card-container:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(139,44,44,0.1);
            border-color: #cbd5e1;
        }

        .text-truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
        
        .notes-truncate {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
      `}</style>

      {toastMessage && (
        <div className="admin-toast">
          <span className="admin-toast-check">✓</span>
          {toastMessage}
        </div>
      )}

      <SectionCard>
        <div
          style={{
            backgroundColor: "#fdfbf7",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e2d8c9",
            marginBottom: "24px",
            direction: "rtl",
          }}
        >
          <div style={{ marginBottom: "16px", position: "relative", maxWidth: "100%" }}>
            <span
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#adb5bd",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="חיפוש תמונה לפי שם..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              dir="rtl"
              style={{
                ...inputStyle,
                padding: "12px 40px 12px 16px",
                borderRadius: "30px",
                backgroundColor: "#fff",
                border: "1px solid #ced4da",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#8b2c2c",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                סינון:
              </span>
              <select
                className="modal-form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                dir="rtl"
                style={{
                  ...inputStyle,
                  padding: "10px 16px",
                  borderRadius: "30px",
                  minWidth: "160px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="">קטגוריה: הכל</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span style={{ color: "#8b2c2c", fontWeight: "bold", fontSize: "14px" }}>מיון לפי:</span>
              <select
                className="modal-form-select"
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value)}
                dir="rtl"
                style={{
                  ...inputStyle,
                  padding: "10px 16px",
                  borderRadius: "30px",
                  minWidth: "160px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="newest">החדש ביותר</option>
                <option value="oldest">הישן ביותר</option>
              </select>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 16,
            direction: "rtl",
          }}
        >
          {displayedImages.map((img) => (
            <div key={img.id} className="image-card-container" onClick={() => handleOpenDetails(img)}>
              <button
                onClick={(e) => triggerDeleteConfirm(e, img)}
                title="מחק תמונה"
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#dc3545",
                  border: "1px solid #f5c6cb",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  zIndex: 5,
                  transition: "0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#dc3545")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: "0.2s", color: "inherit" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#dc3545")}
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>

              <button
                onClick={(e) => toggleIsPublic(e, img)}
                title={img.isPublic ? "הסר מהאתר הציבורי" : "צרף לאתר הציבורי"}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: img.isPublic ? "#2e7d32" : "rgba(255, 255, 255, 0.9)",
                  color: img.isPublic ? "#ffffff" : "#495057",
                  border: `1px solid ${img.isPublic ? "#2e7d32" : "#ced4da"}`,
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  zIndex: 5,
                  transition: "0.2s",
                }}
              >
                {img.isPublic ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                )}
              </button>

              <div
                style={{
                  aspectRatio: "4/3",
                  backgroundImage: `url(${img.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#f8f9fa",
                  borderBottom: "1px solid #e2e8f0",
                }}
              ></div>

              <div style={{ padding: "12px" }}>
                <div
                  className="text-truncate"
                  style={{ fontWeight: 700, color: "#343a40", fontSize: "13.5px" }}
                  title={img.title}
                >
                  {img.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#6c757d",
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(img.category);
                    }}
                    title={`סנן לפי קטגוריה: ${img.category}`}
                    style={{
                      backgroundColor: "#fdfbf7",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      border: "1px solid #e2d8c9",
                      fontWeight: "600",
                      color: "#8b2c2c",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#8b2c2c";
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fdfbf7";
                      e.currentTarget.style.color = "#8b2c2c";
                    }}
                  >
                    {img.category}
                  </span>
                  <span>{img.displayDate}</span>
                </div>
                {img.notes && (
                  <div
                    className="notes-truncate"
                    style={{
                      fontSize: 11,
                      color: "#6c757d",
                      marginTop: 8,
                      fontStyle: "italic",
                      borderTop: "1px dashed #e2e8f0",
                      paddingTop: "6px",
                      lineHeight: "1.4",
                    }}
                    title={img.notes}
                  >
                    {img.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
          {displayedImages.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#adb5bd" }}>
              לא נמצאו תמונות התואמות לחיפוש שלך.
            </div>
          )}
        </div>
      </SectionCard>

      {/* 1. Upload Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            direction: "rtl",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "20px",
              width: "90%",
              maxWidth: "680px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #e2d8c9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.5rem", fontWeight: "bold" }}>העלאת תמונה חדשה</h3>
              <button
                onClick={() => !isUploading && setIsModalOpen(false)}
                style={{
                  background: "#f8f9fa",
                  border: "1px solid #e2d8c9",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#6c757d",
                  transition: "0.2s",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="custom-scroll" style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
              <form id="upload-image-form" onSubmit={handleFinalUpload}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "200px",
                        objectFit: "contain",
                        borderRadius: "12px",
                        border: "1px solid #ced4da",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        height: "120px",
                        width: "100%",
                        border: "2px dashed #ced4da",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6c757d",
                        backgroundColor: "#faf8f5",
                        cursor: "pointer",
                        transition: "0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8b2c2c")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#ced4da")}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ marginBottom: "8px" }}
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      לחץ כאן לבחירת תמונה מהמחשב
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                  {filePreview && (
                    <button
                      type="button"
                      style={{
                        fontSize: "13px",
                        backgroundColor: "#fff",
                        border: "1px solid #ced4da",
                        color: "#495057",
                        padding: "6px 20px",
                        borderRadius: "30px",
                        cursor: "pointer",
                        fontWeight: "600",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                      }}
                      onClick={() => fileInputRef.current.click()}
                    >
                      החלף תמונה
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "600",
                        fontSize: "13.5px",
                        color: "#495057",
                      }}
                    >
                      שם התמונה <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="לדוגמה: פעילות התנדבות"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #ced4da",
                        outline: "none",
                        boxSizing: "border-box",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "600",
                        fontSize: "13.5px",
                        color: "#495057",
                      }}
                    >
                      קטגוריה <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <select
                      className="modal-form-select"
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      style={{ backgroundColor: "#fff" }}
                    >
                      <option value="">-- בחר נושא --</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "600",
                      fontSize: "13.5px",
                      color: "#495057",
                    }}
                  >
                    הערות / תיאור
                  </label>
                  <textarea
                    placeholder="פרטים נוספים על התמונה..."
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #ced4da",
                      outline: "none",
                      resize: "none",
                      boxSizing: "border-box",
                      fontSize: "14px",
                    }}
                  ></textarea>
                  <div className="field" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
  <label style={{ margin: 0, fontWeight: "600", fontSize: "13.5px", color: "#495057" }}>
    🌐 הצג באתר הציבורי:
  </label>
  <input
    type="checkbox"
    checked={formData.isPublic || false}
    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
    style={{ width: "20px", height: "20px", accentColor: "#8B0000", cursor: "pointer" }}
  />
</div>
                </div>
              </form>
            </div>

            <div
              style={{
                padding: "20px 32px",
                borderTop: "1px solid #e2d8c9",
                backgroundColor: "#faf8f5",
                borderBottomLeftRadius: "20px",
                borderBottomRightRadius: "20px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => !isUploading && setIsModalOpen(false)}
                disabled={isUploading}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  color: "#495057",
                }}
              >
                ביטול
              </button>
              <button
                type="submit"
                form="upload-image-form"
                disabled={isUploading}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "none",
                  backgroundColor: "#8b2c2c",
                  color: "white",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                }}
              >
                {isUploading ? "מעלה ושומר..." : "שמור תמונה למאגר"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Image Details & Edit Modal (Lightbox) */}
      {detailsModal.isOpen && detailsModal.image && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15,23,42,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            direction: "rtl",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setIsUpdating(false) || setDetailsModal({ isOpen: false, image: null })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: "20px",
              width: "95%",
              maxWidth: "900px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "95vh",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 32px",
                borderBottom: "1px solid #e2d8c9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.4rem", fontWeight: "bold" }}>פרטי תמונה</h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <a
                  href={detailsModal.image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#f8f9fa",
                    border: "1px solid #e2d8c9",
                    borderRadius: "30px",
                    padding: "6px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    color: "#495057",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  פתח בגודל מלא
                </a>
                <button
                  onClick={() => setDetailsModal({ isOpen: false, image: null })}
                  style={{
                    background: "#f8f9fa",
                    border: "1px solid #e2d8c9",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#6c757d",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div
              className="custom-scroll"
              style={{ display: "flex", flexWrap: "wrap", overflowY: "auto", flexGrow: 1, backgroundColor: "#faf8f5" }}
            >
              <div
                style={{
                  flex: "1 1 50%",
                  minWidth: "300px",
                  padding: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#e9ecef",
                }}
              >
                <img
                  src={detailsModal.image.url}
                  alt={detailsModal.image.title}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "500px",
                    objectFit: "contain",
                    borderRadius: "12px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  }}
                />
              </div>

              <div
                style={{
                  flex: "1 1 50%",
                  minWidth: "300px",
                  padding: "32px",
                  backgroundColor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#495057",
                    }}
                  >
                    שם התמונה
                  </label>
                  <input
                    type="text"
                    value={detailsModal.image.title}
                    onChange={(e) =>
                      setDetailsModal((prev) => ({ isOpen: true, image: { ...prev.image, title: e.target.value } }))
                    }
                    placeholder="לדוגמה: פעילות התנדבות"
                    style={{
                      ...inputStyle,
                      fontSize: "16px",
                      fontWeight: "bold",
                      backgroundColor: "#fff",
                      color: "#0f172a",
                      border: "1px solid #ced4da",
                    }}
                  />

                  {/* التعديل المعماري هنا: تنسيق جديد للقائمة المنسدلة لتبدو كشارة أنيقة ومصغرة */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "center",
                      color: "#6c757d",
                      fontSize: "14px",
                      marginTop: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <label
                        style={{
                          whiteSpace: "nowrap",
                          fontWeight: "600",
                          fontSize: "14px",
                          color: "#495057",
                          margin: 0,
                        }}
                      >
                        קטגוריה:
                      </label>
                      <select
                        className="modal-form-select"
                        value={detailsModal.image.category}
                        onChange={(e) =>
                          setDetailsModal((prev) => ({
                            isOpen: true,
                            image: { ...prev.image, category: e.target.value },
                          }))
                        }
                        style={{
                          ...inputStyle,
                          width: "auto",
                          minWidth: "140px",
                          backgroundColor: "#fdfbf7",
                          padding: "6px 12px",
                          paddingLeft: "35px",
                          borderRadius: "20px",
                          border: "1px solid #e2d8c9",
                          fontWeight: "600",
                          color: "#8b2c2c",
                          fontSize: "13.5px",
                          margin: 0,
                          cursor: "pointer",
                        }}
                      >
                        <option value="">בחר נושא</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span style={{ borderRight: "1px solid #ced4da", paddingRight: "16px" }}>
                      הועלה ב: {detailsModal.image.displayDate}
                    </span>
                  </div>
                </div>

                <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#495057",
                    }}
                  >
                    הערות ותיאור
                  </label>
                  <textarea
                    value={detailsModal.image.notes}
                    onChange={(e) =>
                      setDetailsModal((prev) => ({ isOpen: true, image: { ...prev.image, notes: e.target.value } }))
                    }
                    style={{
                      width: "100%",
                      flexGrow: 1,
                      minHeight: "150px",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #ced4da",
                      outline: "none",
                      resize: "none",
                      boxSizing: "border-box",
                      fontSize: "15px",
                      lineHeight: "1.6",
                      backgroundColor: "#fdfbf7",
                    }}
                    placeholder="הוסף הערות או תיאור לתמונה זו..."
                  ></textarea>

                  <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="checkbox"
                      id="modal-is-public"
                      checked={detailsModal.image.isPublic || false}
                      onChange={(e) =>
                        setDetailsModal((prev) => ({
                          isOpen: true,
                          image: { ...prev.image, isPublic: e.target.checked },
                        }))
                      }
                      style={{ width: "18px", height: "18px", accentColor: "#8b2c2c", cursor: "pointer" }}
                    />
                    <label
                      htmlFor="modal-is-public"
                      style={{ fontWeight: "600", fontSize: "14px", color: "#495057", cursor: "pointer", margin: 0 }}
                    >
                      🌐 הצג באתר הציבורי (בגלריה הציבורית)
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                  <button
                    onClick={handleUpdateImageDetails}
                    disabled={isUpdating}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "30px",
                      border: "none",
                      backgroundColor: "#8b2c2c",
                      color: "white",
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      fontSize: "15px",
                      boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                      transition: "0.2s",
                    }}
                  >
                    {isUpdating ? "שומר שינויים..." : "שמור שינויים בפרטים"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5000,
            direction: "rtl",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "32px",
              borderRadius: "20px",
              textAlign: "center",
              width: "90%",
              maxWidth: "400px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                backgroundColor: "#fdecec",
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc3545"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h4 style={{ color: "#343a40", fontWeight: "bold", margin: "0 0 12px 0", fontSize: "1.2rem" }}>
              מחיקת תמונה
            </h4>
            <p style={{ color: "#6c757d", fontSize: "14px", margin: "0 0 30px 0", lineHeight: "1.5" }}>
              האם אתה בטוח שברצונך למחוק את התמונה <strong>"{deleteConfirm.image?.title}"</strong>? לא ניתן יהיה לשחזר
              אותה לאחר מכן.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, image: null })}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#475569",
                  transition: "all 0.2s",
                }}
              >
                ביטול
              </button>
              <button
                onClick={executeDelete}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "30px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  boxShadow: "0 4px 12px rgba(220,53,69,0.2)",
                }}
              >
                כן, מחק לחלוטין
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}