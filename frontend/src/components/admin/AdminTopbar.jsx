export default function AdminTopbar() {
  return (
    <div className="admin-topbar">
      <div className="admin-search-wrap">
        <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input className="admin-search" placeholder="חיפוש מהיר..." />
      </div>
      <div className="spacer" />
      <button className="admin-notif-btn" aria-label="התראות">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>
      <div className="admin-user">
        <div className="admin-user-meta">
          <div className="admin-user-name">שרה כהן</div>
          <div className="admin-user-role">רכזת ראשית</div>
        </div>
        <div className="admin-user-avatar">ש</div>
      </div>
    </div>
  );
}
