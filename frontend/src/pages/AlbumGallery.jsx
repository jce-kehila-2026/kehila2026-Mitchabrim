// src/pages/AlbumGallery.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import "../styles/public.css";

export default function AlbumGallery() {
  const { albumName } = useParams();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchAlbumImages = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "images"));
        const fetchedImages = [];
        querySnapshot.forEach((doc) => {
          fetchedImages.push({ id: doc.id, ...doc.data() });
        });

        // Filter images by category (album name)
        const albumImages = fetchedImages.filter(
          (img) => img.category === decodeURIComponent(albumName)
        );

        setImages(albumImages);
      } catch (error) {
        console.error("Error fetching album images:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumImages();
  }, [albumName]);

  const openLightbox = (image) => {
    setSelectedImage(image);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setSelectedImage(null);
    document.body.style.overflow = "auto";
  };

  const nextImage = () => {
    const currentIndex = images.indexOf(selectedImage);
    if (currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    }
  };

  const prevImage = () => {
    const currentIndex = images.indexOf(selectedImage);
    if (currentIndex > 0) {
      setSelectedImage(images[currentIndex - 1]);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return;
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, images]);

  if (loading) {
    return (
      <div className="public-page">
        <div className="container" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="loader"></div>
          <p style={{ color: "#666", marginTop: "20px" }}>טוען תמונות...</p>
        </div>
      </div>
    );
  }

  const decodedAlbumName = decodeURIComponent(albumName);

  return (
    <div className="public-page">
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
          <Link 
            to="/gallery" 
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#8B0000",
              textDecoration: "none",
              fontWeight: "500",
              padding: "8px 16px",
              borderRadius: "30px",
              background: "#f5f0ed",
              transition: "background 0.3s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#e8ddd5"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f5f0ed"}
          >
            ← חזרה לגלריה
          </Link>
          <h1 style={{ color: "#8B0000", fontSize: "2rem", margin: 0 }}>
            📸 {decodedAlbumName}
          </h1>
          <span style={{ 
            color: "#666", 
            fontSize: "0.95rem",
            marginRight: "auto",
            background: "#f5f0ed",
            padding: "4px 14px",
            borderRadius: "20px"
          }}>
            {images.length} תמונות
          </span>
        </div>

        {/* Image Grid */}
        {images.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
            <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🖼️</span>
            <h2 style={{ color: "#666" }}>אין תמונות באלבום זה</h2>
            <p>עדיין לא הועלו תמונות לקטגוריה זו.</p>
            <Link 
              to="/gallery" 
              style={{
                display: "inline-block",
                marginTop: "20px",
                color: "#8B0000",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              ← חזרה לגלריה
            </Link>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "20px",
          }}>
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => openLightbox(img)}
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  background: "white",
                  border: "1px solid #f0e8e4",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(139,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
                }}
              >
                <div style={{
                  aspectRatio: "4/3",
                  backgroundImage: `url(${img.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#f5f0ed",
                }} />
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: "600", color: "#333", fontSize: "14px" }}>
                    {img.title}
                  </div>
                  {img.notes && (
                    <div style={{ 
                      fontSize: "12px", 
                      color: "#888", 
                      marginTop: "4px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {img.notes}
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: "#aaa", marginTop: "6px" }}>
                    {img.displayDate || ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedImage && (
          <div
            onClick={closeLightbox}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              cursor: "pointer",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
              style={{
                position: "absolute",
                top: "20px",
                right: "30px",
                background: "none",
                border: "none",
                color: "white",
                fontSize: "40px",
                cursor: "pointer",
                zIndex: 10001,
                transition: "transform 0.3s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              ×
            </button>

            {/* Previous Button */}
            {images.indexOf(selectedImage) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                style={{
                  position: "absolute",
                  left: "20px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  fontSize: "30px",
                  padding: "15px 20px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
              >
                ←
              </button>
            )}

            {/* Next Button */}
            {images.indexOf(selectedImage) < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                style={{
                  position: "absolute",
                  right: "20px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  fontSize: "30px",
                  padding: "15px 20px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
              >
                →
              </button>
            )}

            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              style={{
                maxWidth: "90%",
                maxHeight: "85%",
                objectFit: "contain",
                borderRadius: "8px",
                cursor: "default",
              }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Image Info */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                bottom: "30px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "12px 24px",
                borderRadius: "12px",
                textAlign: "center",
                maxWidth: "80%",
                backdropFilter: "blur(10px)",
              }}
            >
              <div style={{ fontWeight: "600", fontSize: "16px" }}>
                {selectedImage.title}
              </div>
              {selectedImage.notes && (
                <div style={{ fontSize: "13px", opacity: 0.8, marginTop: "4px" }}>
                  {selectedImage.notes}
                </div>
              )}
              <div style={{ fontSize: "12px", opacity: 0.6, marginTop: "6px" }}>
                {selectedImage.category} • {selectedImage.displayDate || ""}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.5, marginTop: "4px" }}>
                {images.indexOf(selectedImage) + 1} / {images.length}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}