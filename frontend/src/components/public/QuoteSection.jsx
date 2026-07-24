import useSiteContent from "@/hooks/useSiteContent";

export default function QuoteSection() {
  const { content } = useSiteContent();
  const q = content.quote;
  return (
    <section className="quote-section-v2">
      <span className="qv-shape qv-shape-circle-lg" aria-hidden />
      <span className="qv-shape qv-shape-circle-sm" aria-hidden />
      <span className="qv-shape qv-shape-dots" aria-hidden />
      <svg className="qv-leaf" viewBox="0 0 120 180" aria-hidden>
        <path d="M60 10 C 20 60 20 130 60 170 C 100 130 100 60 60 10 Z M60 10 L60 170" fill="none" stroke="#E89A4A" strokeWidth="2" opacity="0.55" />
        <path d="M60 50 L30 70 M60 80 L25 100 M60 110 L30 130 M60 50 L90 70 M60 80 L95 100 M60 110 L90 130" stroke="#E89A4A" strokeWidth="1.5" opacity="0.5" fill="none" strokeLinecap="round" />
      </svg>

      <div className="container">
        <div className="qv-card">
          <div className="qv-portrait-wrap">
            <div className="qv-portrait">
              {q.image && <img src={q.image} alt={q.author || "ציטוט"} loading="lazy" decoding="async" />}
            </div>
            <div className="qv-logo-badge" aria-hidden>
              <svg viewBox="0 0 32 32" width="22" height="22">
                <path d="M16 26 C 8 20 4 14 8 9 C 11 5 15 7 16 10 C 17 7 21 5 24 9 C 28 14 24 20 16 26 Z" fill="#fff" />
              </svg>
            </div>
          </div>

          <div className="qv-content">
            <div className="qv-eyebrow">
              <span className="qv-line" aria-hidden />
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path d="M12 21s-7-4.5-9.5-9C.8 8.5 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6.2 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z" fill="none" stroke="#E89A4A" strokeWidth="1.8" />
              </svg>
              <span className="qv-eyebrow-text">{q.eyebrow}</span>
              <span className="qv-line" aria-hidden />
            </div>

            <div className="qv-mark" aria-hidden>“</div>

            <p className="qv-quote">{q.text}</p>

            <div className="qv-divider" aria-hidden>
              <span className="qv-brush" />
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path d="M12 21s-7-4.5-9.5-9C.8 8.5 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6.2 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z" fill="none" stroke="#E89A4A" strokeWidth="1.8" />
              </svg>
              <span className="qv-brush" />
            </div>

            <div className="qv-sign">{q.author}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
