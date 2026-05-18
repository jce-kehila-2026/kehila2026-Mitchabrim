function AdminTopbar() {
  return (
    <header className="admin-topbar">
      <div className="topbar-left">
        <input
          type="text"
          className="search-input"
          placeholder="חיפוש מהיר..."
        />
        <button className="notification-btn">🔔</button>
      </div>
      <div className="topbar-right">
        <div className="admin-info">
          <p className="admin-name">שרה כהן</p>
          <p className="admin-role">רכזת ראשית</p>
        </div>
      </div>
    </header>
  );
}

export default AdminTopbar;