// src/pages/Gallery.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import "../styles/public.css";

const CATEGORIES = ["פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"];

export default function Gallery() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "images"));
        const images = [];
        querySnapshot.forEach((doc) => {
          images.push({ id: doc.id, ...doc.data() });
        });

        // Group images by category
        const albumsMap = {};
        CATEGORIES.forEach((cat) => {
          albumsMap[cat] = [];
        });

        images.forEach((img) => {
          if (img.category && albumsMap[img.category]) {
            albumsMap[img.category].push(img);
          }
        });

        // Convert to array with counts
        const albumsArray = Object.entries(albumsMap).map(([name, images]) => ({
          name,
          images,
          count: images.length,
          coverImage: images.length > 0 ? images[0].url : null,
        }));

        setAlbums(albumsArray);
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  if (loading) {
    return (
      <div className="public-page">
        <div className="container" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="loader"></div>
          <p style={{ color: "#666", marginTop: "20px" }}>טוען אלבומים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page">
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ color: "#8B0000", fontSize: "2.5rem", marginBottom: "10px" }}>📸 גלריית תמונות</h1>
          <p style={{ color: "#666", fontSize: "1.1rem" }}>
            ברוכים הבאים לגלריית התמונות שלנו. בחרו אלבום לצפייה בתמונות.
          </p>
        </div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
          gap: "24px"
        }}>
          {albums.map((album) => (
            <Link 
              key={album.name} 
              to={`/gallery/album/${encodeURIComponent(album.name)}`}
              style={{ textDecoration: "none" }}
            >
              <div style={{
                background: "white",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                cursor: "pointer",
                border: "1px solid #f0e8e4",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(139,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)";
              }}
              >
                <div style={{
                  height: "200px",
                  background: album.coverImage ? `url(${album.coverImage})` : "#f5f0ed",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#f5f0ed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}>
                  {!album.coverImage && (
                    <span style={{ fontSize: "48px", opacity: 0.3 }}>🖼️</span>
                  )}
                  {album.count > 0 && (
                    <div style={{
                      position: "absolute",
                      bottom: "12px",
                      right: "12px",
                      background: "rgba(139,0,0,0.85)",
                      color: "white",
                      padding: "4px 14px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}>
                      {album.count} תמונות
                    </div>
                  )}
                </div>
                <div style={{ padding: "20px", flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <h3 style={{
                    color: "#8B0000",
                    fontSize: "1.2rem",
                    margin: "0 0 8px 0",
                    fontWeight: "600",
                  }}>
                    {album.name}
                  </h3>
                  <p style={{
                    color: "#888",
                    fontSize: "0.9rem",
                    margin: "0",
                    flexGrow: 1,
                  }}>
                    {album.count === 0 ? "אין תמונות באלבום זה" : `${album.count} תמונות בגלריה`}
                  </p>
                  <div style={{
                    marginTop: "12px",
                    color: "#8B0000",
                    fontSize: "14px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}>
                    לצפייה באלבום →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {albums.every(a => a.count === 0) && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
            <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>📷</span>
            <h2 style={{ color: "#666" }}>אין אלבומים זמינים</h2>
            <p>עדיין לא הועלו תמונות למערכת. חזור מאוחר יותר.</p>
          </div>
        )}
      </div>
    </div>
  );
}