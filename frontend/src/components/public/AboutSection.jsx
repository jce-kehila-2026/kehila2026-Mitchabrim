export default function AboutSection() {
  return (
    <section id="about" className="pub-section">
      <div className="container">
        <span className="section-eyebrow">אודות</span>
        <h2 className="section-title">אודות הפרויקט</h2>
        <div className="about-grid">
          <div className="about-text">
            <p>"מתחברים" הוא פרויקט קהילתי שמטרתו לחזק את הקשר בין אזרחים ותיקים לבין הקהילה סביבם.</p>
            <p>המערכת מסייעת בניהול קשר עם אזרחים ותיקים, מתנדבים, פרויקטי חגים, פרלמנטים, תמונות, קישורים ודוחות.</p>
            <p>המטרה היא לאפשר עבודה מסודרת, נגישה ויעילה עבור הצוות והמתנדבים – כדי שכל אזרח ותיק יקבל את היחס והליווי שמגיע לו.</p>
          </div>
          <div className="about-highlights">
            <div className="highlight">
              <div className="highlight-dot">❤️</div>
              <div><h4>קשר אישי</h4><p>מתנדב קבוע לכל אזרח ותיק – שיחה, ביקור וליווי.</p></div>
            </div>
            <div className="highlight">
              <div className="highlight-dot">🤝</div>
              <div><h4>התנדבות קהילתית</h4><p>שיתופי פעולה עם בתי ספר, חברות וארגונים בעיר.</p></div>
            </div>
            <div className="highlight">
              <div className="highlight-dot">📋</div>
              <div><h4>ניהול מסודר</h4><p>מערכת אחת לכל הצוות – מעקב, דוחות ותיאום פעילויות.</p></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
