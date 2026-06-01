export default function PublicFooter() {
  return (
    <footer className="pub-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>מתחברים</h4>
            <p>מחברים אנשים, מתנדבים וקהילה.</p>
            <p style={{ marginTop: 10 }}>פרויקט קהילתי בירושלים לחיבור אזרחים ותיקים לקהילה ולמתנדבים.</p>
          </div>
          <div>
            <h4>ניווט מהיר</h4>
            <ul>
              <li><a href="#about">אודות</a></li>
              <li><a href="#activities">העשייה שלנו</a></li>
              <li><a href="#team">הצוות</a></li>
              <li><a href="#join">הצטרפות</a></li>
            </ul>
          </div>
          <div>
            <h4>יצירת קשר</h4>
            <ul>
              <li>טלפון: 02-0000000</li>
              <li>אימייל: info@mitchabrim.org</li>
              <li>ירושלים</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} מתחברים. כל הזכויות שמורות.</div>
      </div>
    </footer>
  );
}
