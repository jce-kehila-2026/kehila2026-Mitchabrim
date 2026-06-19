import logo from "@/assets/logo.png";

export default function PublicFooter() {
  return (
    <footer className="pub-footer">
      <svg className="footer-wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
        <path d="M0,50 C240,90 480,10 720,40 C960,70 1200,90 1440,40 L1440,0 L0,0 Z" fill="var(--color-bg)" />
      </svg>

      <div className="container">
        <div className="footer-grid-4">
          <div className="footer-col">
            <div className="footer-brand">
              <img src={logo} alt="מתחברים" />
              <div>
                <div className="footer-brand-name">מתחברים</div>
                <div className="footer-brand-sub">חיבור אזרחים בודדים לקהילה</div>
              </div>
            </div>
            <p className="footer-desc">
              מתחברים – חיבור אזרחים בודדים לקהילה דרך מתנדבים,
              פעילויות וליווי קהילתי בירושלים.
            </p>
          </div>

          <div className="footer-col">
            <h4>ניווט</h4>
            <ul>
              <li><a href="#">בית</a></li>
              <li><a href="#about">אודות</a></li>
              <li><a href="#activities">פעילויות</a></li>
              <li><a href="#join">התנדבות</a></li>
              <li><a href="#join">הצטרפות</a></li>
              <li><a href="/login">כניסה</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>יצירת קשר</h4>
            <ul className="footer-contact">
              <li><span className="f-ico">📞</span> 02 - 000 - 0000</li>
              <li><span className="f-ico">✉</span> info@mitchabrim.org</li>
              <li><span className="f-ico">📍</span> ירושלים</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>עקבו אחרינו</h4>
            <div className="footer-socials">
              <a href="#" aria-label="Instagram" className="f-soc">IG</a>
              <a href="#" aria-label="Facebook" className="f-soc">FB</a>
              <a href="#" aria-label="LinkedIn" className="f-soc">in</a>
              <a href="#" aria-label="YouTube" className="f-soc">YT</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">© 2026 מתחברים | כל הזכויות שמורות</div>
      </div>
    </footer>
  );
}
