import { useState, useRef, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

// Import Firebase tools
import { storage, db } from "../firebase"; 
// Added deleteObject to remove the file from Storage
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
// Added doc and deleteDoc to remove the metadata from Firestore
import { collection, addDoc, getDocs, doc, deleteDoc } from "firebase/firestore";

const CATEGORIES = ["הכל", "פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"];

export default function Media() {
  const [activeCategory, setActiveCategory] = useState("הכל");
  const [imagesList, setImagesList] = useState([]);
  
  // --- New Logic: State to track if an upload is currently in progress ---
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);

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

  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Start the loading state -> UI changes to "Uploading..."
    setIsUploading(true);

    try {
      const imageRef = ref(storage, `images/${Date.now()}_${file.name}`); 
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);

      const todayDate = new Date().toLocaleDateString('he-IL');
      const newImageDoc = {
        title: file.name,
        category: activeCategory, 
        url: url,
        date: todayDate
      };

      const docRef = await addDoc(collection(db, "images"), newImageDoc);
      setImagesList((prevList) => [...prevList, { id: docRef.id, ...newImageDoc }]);
      alert("העלאת התמונה בוצעה בהצלחה! (Upload successful!)"); 

    } catch (error) {
      console.error("Error during upload/saving:", error);
      alert("An error occurred during upload. Please try again.");
    } finally {
      // End the loading state regardless of success or failure
      setIsUploading(false);
      // Reset the hidden input so the user can upload the exact same file again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- New Logic: Delete an image ---
  const handleDeleteImage = async (imageToDelete) => {
    // 1. Ask for confirmation before deleting
    const isConfirmed = window.confirm(`האם אתה בטוח שברצונך למחוק את התמונה "${imageToDelete.title}"?`);
    if (!isConfirmed) return;

    try {
      // 2. Delete the document from Firestore Database
      await deleteDoc(doc(db, "images", imageToDelete.id));

      // 3. Delete the actual file from Firebase Storage using its URL
      const imageStorageRef = ref(storage, imageToDelete.url);
      await deleteObject(imageStorageRef);

      // 4. Instantly remove the image from the screen by filtering it out of the array
      setImagesList((prevList) => prevList.filter((img) => img.id !== imageToDelete.id));
      
    } catch (error) {
      console.error("Error deleting image:", error);
      alert("An error occurred while deleting the image.");
    }
  };

  const displayedImages = imagesList.filter((img) => 
    activeCategory === "הכל" || img.category === activeCategory
  );

  return (
    <AdminLayout
      title="מאגר תמונות"
      subtitle="ניהול תמונות לפי נושאים"
      actions={
        <>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*"
          />
          {/* Enhanced button with dynamic loading state */}
          <button 
            className="btn btn-primary" 
            onClick={handleUploadButtonClick}
            disabled={isUploading}
            style={{ opacity: isUploading ? 0.7 : 1, cursor: isUploading ? "not-allowed" : "pointer" }}
          >
            {isUploading ? "מעלה תמונה..." : "+ העלאת תמונה"}
          </button>
        </>
      }
    >
      <SectionCard>
        <div className="search-filters">
          {CATEGORIES.map((category) => (
            <button 
              key={category} 
              className={`btn ${activeCategory === category ? 'btn-primary' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {displayedImages.map((img) => (
            // Added position: relative to the card to place the delete button inside it
            <div key={img.id} className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
              
              {/* Delete Button (Absolute position top-right) */}
              <button
                onClick={() => handleDeleteImage(img)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(220, 53, 69, 0.9)", // Red Bootstrap color
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  zIndex: 10
                }}
                title="מחק תמונה"
              >
                🗑️
              </button>

              <div 
                style={{ 
                  aspectRatio: "4/3", 
                  backgroundImage: `url(${img.url})`, 
                  backgroundSize: "cover", 
                  backgroundPosition: "center",
                  backgroundColor: "#f6ecdc" 
                }}
              ></div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700 }} title={img.title}>
                  {img.title.length > 20 ? img.title.substring(0, 20) + "..." : img.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  {img.category} • {img.date}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AdminLayout>
  );
}