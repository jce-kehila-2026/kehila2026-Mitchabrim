import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import PublicNavbar from "@/components/public/PublicNavbar.jsx";
import HeroSection from "@/components/public/HeroSection.jsx";
import ActivitiesSection from "@/components/public/ActivitiesSection.jsx";
import AboutSection from "@/components/public/AboutSection.jsx";
import QuoteSection from "@/components/public/QuoteSection.jsx";
import TeamSection from "@/components/public/TeamSection.jsx";
import GallerySection from "@/components/public/GallerySection.jsx";
import PartnersSection from "@/components/public/PartnersSection.jsx";
import JoinRequestSection from "@/components/public/JoinRequestSection.jsx";
import PressSection from "@/components/public/PressSection.jsx";
import PublicFooter from "@/components/public/PublicFooter.jsx";

export default function Home() {
  const location = useLocation();

  // هذا الكود السحري يراقب الرابط، وإذا وجد هاشتاج ينزل للقسم بدقة مخصصة
  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const element = document.querySelector(location.hash);
        if (element) {
          // 👈 هذا الرقم هو السر! كل ما صغرته (أو خليته 0)، الصفحة بتنزل لتحت أكثر
          // وكل ما كبرته، الصفحة بتوقف لفوق أكثر. جرب 40 وإذا بدك إياها تنزل كمان سويها 20 או 0
          const offset = 40;

          // حساب المسافة الدقيقة للقسم من أعلى الصفحة
          const y = element.getBoundingClientRect().top + window.scrollY - offset;

          window.scrollTo({
            top: y,
            behavior: "smooth",
          });
        }
      }, 150);
    } else {
      window.scrollTo(0, 0); // إذا لم يكن هناك هاشتاج، افتح الصفحة من أعلى
    }
  }, [location]);
  return (
    <div className="homepage-background">
      <PublicNavbar />
      <HeroSection />
      <AboutSection />
      <PartnersSection />
      <ActivitiesSection />
      <QuoteSection />
      <GallerySection />
      <TeamSection />
      <PressSection />
      <JoinRequestSection />
      <PublicFooter />
    </div>
  );
}
