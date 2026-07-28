const shapes = {
  leaf: (
    <>
      <path d="M52 196C58 137 91 84 148 34" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M79 138C42 133 27 108 23 82c34 2 55 22 56 56ZM96 108c-4-37 14-61 43-73 8 33-5 59-43 73ZM60 169c-29 0-47-17-54-39 28-3 48 10 54 39ZM119 79c2-29 18-48 42-58 4 28-10 49-42 58Z" fill="currentColor" opacity=".55" />
    </>
  ),
  leafAlt: (
    <>
      <path d="M151 195C144 137 112 83 52 31" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M123 138c38-3 57-25 60-53-35 1-56 20-60 53ZM105 108c5-38-12-62-42-75-9 34 4 61 42 75ZM143 169c29-1 48-17 54-40-28-2-48 11-54 40ZM82 78c-1-28-17-48-42-58-3 28 11 49 42 58Z" fill="currentColor" opacity=".55" />
    </>
  ),
  heart: (
    <path d="M100 178 31 109C-10 68 17 17 59 22c19 2 32 13 41 29 9-16 22-27 41-29 42-5 69 46 28 87l-69 69Z" fill="currentColor" opacity=".72" />
  ),
  arc: (
    <path d="M18 174C65 66 139 20 230 27c58 4 104 31 137 78" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray="2 20" />
  ),
  dots: (
    <>
      {Array.from({ length: 30 }, (_, i) => (
        <circle
          key={i}
          cx={18 + (i % 6) * 32}
          cy={18 + Math.floor(i / 6) * 32}
          r={3 + (i % 3)}
          fill="currentColor"
          opacity={0.35 + (i % 4) * 0.12}
        />
      ))}
    </>
  ),
  brush: (
    <>
      <path d="M10 104C83 45 174 34 369 61c-105 11-173 35-246 87 91-34 171-42 267-23-135 8-238 33-351 64" fill="none" stroke="currentColor" strokeWidth="25" strokeLinecap="round" opacity=".28" />
      <path d="M32 76c102-38 198-42 338-14" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" opacity=".52" />
    </>
  ),
  brushDots: (
    <>
      <path d="M8 140C112 51 232 28 392 56" fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" opacity=".26" />
      {Array.from({ length: 22 }, (_, i) => (
        <circle
          key={i}
          cx={28 + (i % 11) * 33}
          cy={82 + Math.floor(i / 11) * 48 + (i % 2) * 8}
          r={3 + (i % 3)}
          fill="currentColor"
          opacity=".58"
        />
      ))}
    </>
  ),
};

const D = ({ variant, className, style }) => (
  <svg
    viewBox={variant === "brush" || variant === "brushDots" ? "0 0 400 220" : variant === "arc" ? "0 0 390 210" : "0 0 200 210"}
    aria-hidden="true"
    className={`decor ${className}`}
    style={style}
    focusable="false"
  >
    {shapes[variant]}
  </svg>
);

export default function BackgroundDecorations() {
  return (
    <div className="page-decorations" aria-hidden="true">
      <D variant="leaf" className="decor-leaf decor-pos-1" style={{ top: "120px", left: "-40px", width: "220px", transform: "rotate(-15deg)", opacity: 0.16 }} />
      <D variant="brushDots" className="decor-brush decor-pos-2" style={{ top: "240px", right: "-60px", width: "420px", opacity: 0.22 }} />
      <D variant="dots" className="decor-dots decor-pos-3" style={{ top: "640px", left: "5%", width: "160px", opacity: 0.25 }} />

      <D variant="arc" className="decor-arc decor-pos-4" style={{ top: "1100px", right: "8%", width: "320px", opacity: 0.18 }} />
      <D variant="leafAlt" className="decor-leaf decor-pos-5" style={{ top: "1380px", left: "-30px", width: "200px", transform: "rotate(20deg)", opacity: 0.14 }} />

      <D variant="heart" className="decor-heart decor-pos-6" style={{ top: "1900px", right: "6%", width: "90px", opacity: 0.22 }} />
      <D variant="brush" className="decor-brush decor-pos-7" style={{ top: "2200px", left: "-80px", width: "380px", opacity: 0.2 }} />

      <D variant="dots" className="decor-dots decor-pos-8" style={{ top: "2700px", right: "8%", width: "180px", opacity: 0.22 }} />
      <D variant="leaf" className="decor-leaf decor-pos-9" style={{ top: "2950px", left: "4%", width: "180px", transform: "rotate(-30deg) scaleX(-1)", opacity: 0.14 }} />

      <D variant="arc" className="decor-arc decor-pos-10" style={{ top: "3400px", left: "-40px", width: "300px", transform: "rotate(180deg)", opacity: 0.16 }} />
      <D variant="heart" className="decor-heart decor-pos-11" style={{ top: "3500px", right: "10%", width: "70px", opacity: 0.2 }} />

      <D variant="leafAlt" className="decor-leaf decor-pos-12" style={{ top: "4100px", right: "-30px", width: "220px", transform: "rotate(-10deg)", opacity: 0.14 }} />
      <D variant="brushDots" className="decor-brush decor-pos-13" style={{ top: "4350px", left: "-80px", width: "400px", transform: "scaleX(-1)", opacity: 0.2 }} />

      <D variant="dots" className="decor-dots decor-pos-14" style={{ top: "4900px", right: "6%", width: "150px", opacity: 0.22 }} />
      <D variant="leaf" className="decor-leaf decor-pos-15" style={{ top: "5100px", left: "3%", width: "190px", transform: "rotate(15deg)", opacity: 0.14 }} />
    </div>
  );
}
