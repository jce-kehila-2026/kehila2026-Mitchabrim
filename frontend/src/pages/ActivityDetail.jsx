import { useEffect } from "react"; // 1. أضفنا هذا السطر
import { Link, useParams, Navigate } from "react-router-dom";
import PublicNavbar from "@/components/public/PublicNavbar.jsx";
import PublicFooter from "@/components/public/PublicFooter.jsx";
import BackgroundDecorations from "@/components/public/BackgroundDecorations.jsx";
import { getActivityBySlug } from "@/data/activities";

function NL({ text }) {
  return (text || "").split("\n").map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && (
        <>
          <br />
          <br />
        </>
      )}
    </span>
  ));
}

export default function ActivityDetail() {
  const { slug } = useParams();
  const activity = getActivityBySlug(slug);

  // 2. إجبار الصفحة تفتح من أعلى دائماً (حل المشكلة 2)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!activity) return <Navigate to="/" replace />;

  return (
    <div className="homepage-background">
      <BackgroundDecorations />
      <PublicNavbar />

      <section className="pub-section activity-detail">
        <div className="container">
          <nav className="activity-breadcrumbs" aria-label="breadcrumbs">
            <Link to="/">בית</Link>
            <span aria-hidden="true">›</span>
            <Link to="/#activities">העשייה שלנו</Link>
            <span aria-hidden="true">›</span>
            <span className="activity-breadcrumbs-current">{activity.title}</span>
          </nav>

          <div className="activity-grid">
            <div className="activity-text">
              <h1 className="activity-title">{activity.title}</h1>
              <svg
                className="activity-underline"
                viewBox="0 0 220 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 9 C 50 2, 120 14, 217 5"
                  stroke="#E89A4A"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>

              <p className="activity-body">
                <NL text={activity.longDescription} />
              </p>

              <div className="activity-cta">
                {/* 3. استخدمنا a بدلاً من Link لحل المشكلة 5 */}
                <a href="/#activities" className="btn btn-outline">
                  ← שירותים אחרים
                </a>
                <a href="/#contact" className="btn btn-primary">
                  יצירת קשר
                </a>
              </div>
            </div>

            <div className="activity-media">
              <img src={activity.image} alt={activity.title} />
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}