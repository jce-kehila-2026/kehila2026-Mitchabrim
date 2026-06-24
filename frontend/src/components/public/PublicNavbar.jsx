import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { ACTIVITIES } from "@/data/activities";

const NAV_ITEMS = [
  { href: "/#about", label: "אודות" },
  { href: "/#partners", label: "שותפים" },
  { href: "/#activities", label: "העשייה שלנו", dropdown: true },
  { href: "/#team", label: "צוות" },
  { href: "/#gallery", label: "גלריה" },
  { href: "/#join", label: "יצירת קשר" },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [mobileDdOpen, setMobileDdOpen] = useState(false);
  const ddRef = useRef(null);
  const ddTimerRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleLinkClick = () => {
    setOpen(false);
    setDdOpen(false);
    setMobileDdOpen(false);
  };

  const handleDdMouseEnter = () => {
    if (ddTimerRef.current) {
      clearTimeout(ddTimerRef.current);
      ddTimerRef.current = null;
    }
    setDdOpen(true);
  };

  const handleDdMouseLeave = () => {
    ddTimerRef.current = setTimeout(() => setDdOpen(false), 200);
  };

  const toggleMobileDd = () => {
    setMobileDdOpen((v) => !v);
  };

  return (
    <header className="pub-navbar">
      <div className="container pub-nav-inner">
        <Link to="/" className="pub-brand" aria-label="מתחברים">
          <img src={logo} alt="מתחברים" />
        </Link>

        <nav className="pub-nav-links">
          {NAV_ITEMS.map((item) =>
            item.dropdown ? (
              <div
                key={item.href}
                className="pub-nav-item"
                ref={ddRef}
                onMouseEnter={handleDdMouseEnter}
                onMouseLeave={handleDdMouseLeave}
              >
                <button
                  type="button"
                  className="pub-nav-trigger"
                  aria-haspopup="menu"
                  aria-expanded={ddOpen}
                  onClick={() => setDdOpen((v) => !v)}
                >
                  <span>{item.label}</span>
                  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2 4l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {ddOpen && (
                  <div className="pub-nav-dropdown" role="menu">
                    <a
                      href="/#activities"
                      onClick={() => setDdOpen(false)}
                      role="menuitem"
                    >
                      כל העשייה
                    </a>
                    {ACTIVITIES.map((a) => (
                      <Link
                        key={a.slug}
                        to={`/our-work/${a.slug}`}
                        onClick={() => setDdOpen(false)}
                        role="menuitem"
                      >
                        {a.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            )
          )}
        </nav>

        <div className="pub-nav-cta">
          <Link to="/login" className="btn btn-primary">
            התחברות
          </Link>
        </div>

        <button
          className={`pub-nav-toggle ${open ? "is-open" : ""}`}
          aria-label="פתח תפריט"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className="pub-nav-mobile" onClick={handleLinkClick}>
          <div
            className="pub-nav-mobile-inner"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_ITEMS.map((item) =>
              item.dropdown ? (
                <div key={item.href}>
                  <a
                    href={item.href}
                    onClick={toggleMobileDd}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span>{item.label}</span>
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{
                        width: 12,
                        height: 12,
                        transition: "transform 0.2s ease",
                        transform: mobileDdOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      <path
                        d="M2 4l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                  {mobileDdOpen && (
                    <>
                      <div className="pub-nav-mobile-group-label">פעילויות</div>
                      {ACTIVITIES.map((a) => (
                        <Link
                          key={a.slug}
                          to={`/our-work/${a.slug}`}
                          className="pub-nav-mobile-sublink"
                          onClick={handleLinkClick}
                        >
                          {a.title}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <a key={item.href} href={item.href} onClick={handleLinkClick}>
                  {item.label}
                </a>
              )
            )}
            <Link to="/login" className="btn btn-primary" onClick={handleLinkClick}>
              התחברות
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}