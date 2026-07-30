import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import PublicNavbar from "@/components/public/PublicNavbar.jsx";
import PublicFooter from "@/components/public/PublicFooter.jsx";
import { getActivityBySlug } from "@/data/activities";
import useSiteContent from "@/hooks/useSiteContent";

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
  const base = getActivityBySlug(slug);
  const { content } = useSiteContent();
  const override = content?.activities?.details?.[slug] || {};

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!base) return <Navigate to="/" replace />;

  const activity = {
    title: override.title?.trim() || base.title,
    longDescription: override.longDescription?.trim() || base.longDescription,
    image: override.image?.trim() || base.image,
  };


  return (
    <div className="homepage-background">
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
              <svg className="activity-underline" viewBox="0 0 220 14" fill="none" aria-hidden="true">
                <path d="M3 9 C 50 2, 120 14, 217 5" stroke="#E89A4A" strokeWidth="4" strokeLinecap="round" />
              </svg>

              <p className="activity-body">
                <NL text={activity.longDescription} />
              </p>

              <div className="activity-cta">
                <Link to="/#activities" className="btn btn-outline">
                  ← שירותים אחרים
                </Link>
                <Link to="/#contact" className="btn btn-primary">
                  יצירת קשר
                </Link>
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
