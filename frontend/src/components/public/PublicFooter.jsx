import logo from "@/assets/logo.png";
import useSiteContent from "@/hooks/useSiteContent";

export default function PublicFooter() {
  const { content } = useSiteContent();
  const f = content.footer;
  return (
    <footer className="pub-footer">
      <svg className="footer-wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
        <path d="M0,50 C240,90 480,10 720,40 C960,70 1200,90 1440,40 L1440,0 L0,0 Z" fill="var(--color-bg)" />
      </svg>

      <div className="container">
        <div className="footer-grid-4">
          <div className="footer-col">
            <div className="footer-brand">
              <img src={logo} alt={f.orgName} />
              <div>
                <div className="footer-brand-name">{f.orgName}</div>
                <div className="footer-brand-sub">{f.tagline}</div>
              </div>
            </div>
            <p className="footer-desc">{f.description}</p>
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
              <li><span className="f-ico">📞</span> {f.phone}</li>
              <li><span className="f-ico">✉</span> {f.email}</li>
              <li><span className="f-ico">📍</span> {f.address}</li>
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

        <div className="footer-bottom">© 2026 {f.orgName} | כל הזכויות שמורות</div>
      </div>
    </footer>
  );
}
