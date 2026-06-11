export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-bg-shape hero-bg-shape-1" aria-hidden />
      <div className="hero-bg-shape hero-bg-shape-2" aria-hidden />

      <div className="container hero-grid">
        <div className="hero-text">
          <span className="section-eyebrow">פרויקט קהילתי בירושלים</span>
          <h1>
            מתחברים בין אזרחים ותיקים,
            <br />
            מתנדבים ו
            <span className="hero-accent">
              קהילה
              <svg className="accent-underline" viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden>
                <path d="M2 8 Q 55 -2 110 7 T 218 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="lead">
            חיבור אזרחים בודדים לקהילה בירושלים – דרך קשר אישי,
            פעילות חברתית וליווי מתמשך.
          </p>
          <div className="hero-cta">
            <a href="#join" className="btn btn-primary btn-lg">אני רוצה להצטרף</a>
          </div>
        </div>

        <div className="hero-collage" aria-hidden>
          <svg className="brush brush-1" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
            <path d="M200,30 C310,40 370,120 360,230 C350,330 250,380 150,360 C50,340 20,230 50,140 C80,60 130,25 200,30Z"
                  fill="var(--color-primary)" opacity=".10" />
          </svg>
          <svg className="brush brush-2" viewBox="0 0 300 300">
            <path d="M150,20 C230,30 280,90 270,170 C260,250 180,290 110,275 C40,260 15,180 35,110 C55,50 100,15 150,20Z"
                  fill="var(--color-accent)" opacity=".14" />
          </svg>

          <div className="circle-img circle-img-lg">
            <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=900&q=80" alt="" />
          </div>
          <div className="circle-img circle-img-md">
            <img src="https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=600&q=80" alt="" />
          </div>
          <div className="circle-img circle-img-sm">
            <img src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=500&q=80" alt="" />
          </div>
        </div>
      </div>
    </section>
  );
}
