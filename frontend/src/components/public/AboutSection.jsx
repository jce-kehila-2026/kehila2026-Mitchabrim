export default function AboutSection() {
  return (
    <section id="about" className="pub-section about-section">
      <div className="container about-grid-clean">
        <div className="about-visual">
          <div className="about-main-img">
            <img
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1100&q=80"
              alt="הקהילה של מתחברים"
            />
          </div>
          <div className="about-img-badge">
            <span className="badge-num">+150</span>
            <span className="badge-label">מתנדבים פעילים</span>
          </div>
        </div>

        <div className="about-content">
          <span className="section-eyebrow">הכירו את מתחברים</span>
          <h2 className="about-headline">
            אנחנו מאמינים שאף אזרח ותיק
            <br />
            לא צריך להרגיש <span className="hero-accent">לבד</span>
          </h2>
          <div className="about-body">
            <p>
              מתחברים נועד ליצור קשרים משמעותיים בין אזרחים ותיקים, מתנדבים
              והקהילה. דרך ביקורים, שיחות, פעילויות ופרלמנטים קהילתיים,
              אנחנו מחזקים תחושת שייכות, ביטחון וחום אנושי.
            </p>
            <p>
              כל חיבור הוא הזדמנות לשנות יום שלם – ולבנות יחד קהילה ירושלמית
              חזקה, חמה ותומכת.
            </p>
          </div>
          <a href="#join" className="btn btn-primary btn-lg">הצטרפו אלינו</a>
        </div>
      </div>
    </section>
  );
}
