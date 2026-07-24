import leaf1 from "@/assets/decorations/decoration-leaf-1.png.asset.json";
import leaf2 from "@/assets/decorations/decoration-leaf-2.png.asset.json";
import heart from "@/assets/decorations/decoration-heart.png.asset.json";
import arc from "@/assets/decorations/decoration-dotted-arc.png.asset.json";
import brush from "@/assets/decorations/decoration-brush.png.asset.json";
import brushDots from "@/assets/decorations/decoration-brush-dots.png.asset.json";
import dots from "@/assets/decorations/decoration-dots.png.asset.json";

const D = ({ src, className, style, alt = "" }) => (
  <img
    src={src}
    alt={alt}
    aria-hidden="true"
    className={`decor ${className}`}
    style={style}
    loading="lazy"
    decoding="async"
  />
);

export default function BackgroundDecorations() {
  return (
    <div className="page-decorations" aria-hidden="true">
      {/* Hero area */}
      <D src={leaf1.url} className="decor-leaf decor-pos-1" style={{ top: "120px", left: "-40px", width: "220px", transform: "rotate(-15deg)", opacity: 0.16 }} />
      <D src={brushDots.url} className="decor-brush decor-pos-2" style={{ top: "240px", right: "-60px", width: "420px", opacity: 0.22 }} />
      <D src={dots.url} className="decor-dots decor-pos-3" style={{ top: "640px", left: "5%", width: "160px", opacity: 0.25 }} />

      {/* Activities */}
      <D src={arc.url} className="decor-arc decor-pos-4" style={{ top: "1100px", right: "8%", width: "320px", opacity: 0.18 }} />
      <D src={leaf2.url} className="decor-leaf decor-pos-5" style={{ top: "1380px", left: "-30px", width: "200px", transform: "rotate(20deg)", opacity: 0.14 }} />

      {/* About */}
      <D src={heart.url} className="decor-heart decor-pos-6" style={{ top: "1900px", right: "6%", width: "90px", opacity: 0.22 }} />
      <D src={brush.url} className="decor-brush decor-pos-7" style={{ top: "2200px", left: "-80px", width: "380px", opacity: 0.2 }} />

      {/* Quote */}
      <D src={dots.url} className="decor-dots decor-pos-8" style={{ top: "2700px", right: "8%", width: "180px", opacity: 0.22 }} />
      <D src={leaf1.url} className="decor-leaf decor-pos-9" style={{ top: "2950px", left: "4%", width: "180px", transform: "rotate(-30deg) scaleX(-1)", opacity: 0.14 }} />

      {/* Team */}
      <D src={arc.url} className="decor-arc decor-pos-10" style={{ top: "3400px", left: "-40px", width: "300px", transform: "rotate(180deg)", opacity: 0.16 }} />
      <D src={heart.url} className="decor-heart decor-pos-11" style={{ top: "3500px", right: "10%", width: "70px", opacity: 0.2 }} />

      {/* Gallery */}
      <D src={leaf2.url} className="decor-leaf decor-pos-12" style={{ top: "4100px", right: "-30px", width: "220px", transform: "rotate(-10deg)", opacity: 0.14 }} />
      <D src={brushDots.url} className="decor-brush decor-pos-13" style={{ top: "4350px", left: "-80px", width: "400px", transform: "scaleX(-1)", opacity: 0.2 }} />

      {/* Join */}
      <D src={dots.url} className="decor-dots decor-pos-14" style={{ top: "4900px", right: "6%", width: "150px", opacity: 0.22 }} />
      <D src={leaf1.url} className="decor-leaf decor-pos-15" style={{ top: "5100px", left: "3%", width: "190px", transform: "rotate(15deg)", opacity: 0.14 }} />
    </div>
  );
}
