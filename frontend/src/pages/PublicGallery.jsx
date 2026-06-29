// src/pages/PublicGallery.jsx
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import PublicNavbar from "@/components/public/PublicNavbar.jsx";
import PublicFooter from "@/components/public/PublicFooter.jsx";
import "../styles/public.css";

export default function PublicGallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "הכל";

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const q = query(
          collection(db, "images"),
          where("isPublic", "==", true),
          limit(500)
        );
        const querySnapshot = await getDocs(q);
        const fetchedImages = [];
        querySnapshot.forEach((doc) => {
          fetchedImages.push({ id: doc.id, ...doc.data() });
        });
        setImages(fetchedImages);

        const uniqueCategories = [...new Set(fetchedImages.map(img => img.category).filter(Boolean))];
        setCategories(["הכל", ...uniqueCategories]);
      } catch (error) {
        const authState = auth?.currentUser ? `uid=${auth.currentUser.uid}` : "anonymous";
        console.error(
          `[PublicGallery] Failed to fetch Firestore collection 'images' with where("isPublic","==",true). Auth: ${authState}. Code: ${error?.code}`,
          error
        );
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, []);

  useEffect(() => {
    const cat = searchParams.get("category") || "הכל";
    setSelectedCategory(cat);
  }, [searchParams]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    if (cat === "הכל") {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  };

  const filteredImages = selectedCategory === "הכל" 
    ? images 
    : images.filter(img => img.category === selectedCategory);

  return (
    <div className="public-page">
      <PublicNavbar />
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ color: "#8B0000", fontSize: "2.5rem", marginBottom: "10px" }}>
            📸 גלריית תמונות
          </h1>
          <p style={{ color: "#666", fontSize: "1.1rem" }}>
            כל התמונות שהועלו לאתר על ידי הקהילה
          </p>
          <Link to="/" className="btn btn-outline" style={{ marginTop: "12px" }}>
            ← חזרה לעמוד הבית
          </Link>
        </div>

        {categories.length > 1 && (
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            flexWrap: "wrap", 
            justifyContent: "center",
            marginBottom: "30px"
          }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "30px",
                  border: selectedCategory === cat ? "2px solid #8B0000" : "1px solid #ddd",
                  background: selectedCategory === cat ? "#8B0000" : "#fff",
                  color: selectedCategory === cat ? "#fff" : "#333",
                  cursor: "pointer",
                  fontWeight: selectedCategory === cat ? "600" : "400",
                  transition: "all 0.3s",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px" }}>טוען תמונות...</div>
        ) : filteredImages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
            <span style={{ fontSize: "48px", display: "block" }}>🖼️</span>
            <p>אין תמונות להצגה</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "20px",
          }}>
            {filteredImages.map((img) => (
              <div
                key={img.id}
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "#fff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: "1px solid #f0e8e4",
                  transition: "transform 0.3s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <div
                  style={{
                    aspectRatio: "4/3",
                    backgroundImage: `url(${img.url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: "#f5f0ed",
                  }}
                />
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: "600", color: "#333" }}>{img.title}</div>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                    {img.category} • {img.displayDate}
                  </div>
                  {img.notes && (
                    <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                      {img.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}