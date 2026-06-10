import PublicNavbar from "@/components/public/PublicNavbar.jsx";
import HeroSection from "@/components/public/HeroSection.jsx";
import ActivitiesSection from "@/components/public/ActivitiesSection.jsx";
import AboutSection from "@/components/public/AboutSection.jsx";
import QuoteSection from "@/components/public/QuoteSection.jsx";
import TeamSection from "@/components/public/TeamSection.jsx";
import GallerySection from "@/components/public/GallerySection.jsx";
import JoinRequestSection from "@/components/public/JoinRequestSection.jsx";
import PublicFooter from "@/components/public/PublicFooter.jsx";
import BackgroundDecorations from "@/components/public/BackgroundDecorations.jsx";

export default function Home() {
  return (
    <div className="homepage-background">
      <BackgroundDecorations />
      <PublicNavbar />
      <HeroSection />
      <ActivitiesSection />
      <AboutSection />
      <QuoteSection />
      <TeamSection />
      <GallerySection />
      <JoinRequestSection />
      <PublicFooter />
    </div>
  );
}
