import logo from "@/assets/logo.jpeg";

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <span className="section-eyebrow">קהילת ירושלים</span>
          <h1>מתחברים בין אנשים לקהילה</h1>
          <p className="lead">
            פרויקט קהילתי המחבר בין אזרחים ותיקים, מתנדבים וגורמי קהילה בירושלים.
            יחד אנחנו דואגים לכל אחד ואחת שלא יישארו לבד.
          </p>
          <div className="hero-cta">
            <a href="#join" className="btn btn-primary">אני רוצה להצטרף</a>
            <a href="#about" className="btn">קראו עוד עלינו</a>
          </div>
        </div>
        <div className="hero-visual">
          <img src={logo} alt="לוגו מתחברים" />
        </div>
      </div>
    </section>
  );
}
