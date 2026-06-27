import { useEffect, useState } from "react";
import useSiteContent from "@/hooks/useSiteContent";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function GallerySection() {
  const { content } = useSiteContent();
  const g = content.gallery;

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("הכל");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const q = query(
          collection(db, "images"),
          where("isPublic", "==", true)
        );
        const querySnapshot = await getDocs(q);
        const fetched = [];
        querySnapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() });
        });

        // Sort by uploadedAt descending if available, else displayDate or id
        fetched.sort((a, b) => {
          const timeA = a.uploadedAt?.seconds || a.uploadedAt?.toMillis?.() || 0;
          const timeB = b.uploadedAt?.seconds || b.uploadedAt?.toMillis?.() || 0;
          return timeB - timeA;
        });

        setImages(fetched);
      } catch (error) {
        console.error("Error fetching gallery images:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, []);

  // Reset index to 0 when category changes
  useEffect(() => {
    setIndex(0);
  }, [selectedCategory]);

  const filtered = selectedCategory === "הכל"
    ? images
    : images.filter(img => img.category === selectedCategory);

  // Take the last 5 images
  const slides = filtered.slice(0, 5).map(img => ({
    img: img.url,
    title: img.title,
    category: img.category
  }));
  const total = slides.length;

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 3000);
    return () => clearInterval(id);
  }, [paused, total]);

  const goTo = (i) => {
    if (total === 0) return;
    setIndex(((i % total) + total) % total);
  };

  const galleryLink = selectedCategory === "הכל"
    ? "/public-gallery"
    : `/public-gallery?category=${selectedCategory}`;

  const CATEGORIES = ["הכל", "פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"];

  return (
    <section id="gallery" className="pub-section gallery3d-section">
      <div className="container">
        <div className="gallery-header">
          <span className="section-eyebrow">{g.eyebrow}</span>
          <h2 className="section-title">{g.title}</h2>
          <p className="section-sub">{g.subtitle}</p>
          
          {/* أزرار اختيار الفئة - للتصفية المباشرة في الصفحة الرئيسية */}
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            flexWrap: "wrap", 
            justifyContent: "center", 
            marginTop: "20px",
            marginBottom: "20px"
          }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  fontSize: "14px",
                  padding: "8px 16px",
                  color: selectedCategory === cat ? "#fff" : "#8b2c2c",
                  background: selectedCategory === cat ? "#8b2c2c" : "#fffaf2",
                  border: selectedCategory === cat ? "1px solid #8b2c2c" : "1px solid #e2d8c9",
                  borderRadius: "30px",
                  cursor: "pointer",
                  fontWeight: selectedCategory === cat ? "bold" : "500",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== cat) {
                    e.currentTarget.style.background = "#8b2c2c";
                    e.currentTarget.style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== cat) {
                    e.currentTarget.style.background = "#fffaf2";
                    e.currentTarget.style.color = "#8b2c2c";
                  }
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* زر عرض جميع الصور في صفحة منفصلة */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
            <Link to={galleryLink} className="btn btn-outline" style={{ fontWeight: "bold", padding: "10px 24px" }}>
              📸 לצפייה בכל התמונות בקטגוריית {selectedCategory === "הכל" ? "הגלריה" : selectedCategory} ←
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#8b2c2c", fontWeight: "bold" }}>
            טוען תמונות...
          </div>
        ) : total === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: "80px 20px", 
            backgroundColor: "#fffaf2", 
            borderRadius: "20px", 
            border: "1px dashed #e2d8c9",
            maxWidth: "600px",
            margin: "0 auto"
          }}>
            <span style={{ fontSize: "48px" }}>🖼️</span>
            <h3 style={{ color: "#8b2c2c", marginTop: "15px", fontWeight: "bold" }}>אין תמונות להצגה</h3>
            <p style={{ color: "#666", fontSize: "14px" }}>
              עדיין לא הועלו תמונות ציבוריות בקטגוריית "{selectedCategory}".
            </p>
          </div>
        ) : (
          <div
            className="g3d-stage"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {slides.map((s, i) => {
              let pos = i - index;
              if (pos > total / 2) pos -= total;
              if (pos < -total / 2) pos += total;
              const abs = Math.abs(pos);
              if (abs > 2) return null;
              return (
                <div
                  key={i}
                  className={`g3d-card ${pos === 0 ? "is-active" : ""}`}
                  style={{ "--pos": pos, "--abs": abs, zIndex: 10 - abs }}
                  onClick={() => goTo(i)}
                >
                  {s.img && <img src={s.img} alt={s.title} loading="lazy" />}
                  {pos === 0 && <div className="g3d-caption">{s.title}</div>}
                </div>
              );
            })}

            {total > 1 && (
              <>
                <button className="g3d-nav g3d-nav-right" onClick={() => goTo(index - 1)} aria-label="הקודם">›</button>
                <button className="g3d-nav g3d-nav-left" onClick={() => goTo(index + 1)} aria-label="הבא">‹</button>
              </>
            )}
          </div>
        )}

        {total > 1 && (
          <div className="g3d-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`g3d-dot ${i === index ? "active" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`תמונה ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
