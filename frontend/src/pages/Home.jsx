import PublicNavbar from "@/components/public/PublicNavbar.jsx";
import HeroSection from "@/components/public/HeroSection.jsx";
import AboutSection from "@/components/public/AboutSection.jsx";
import ActivitiesSection from "@/components/public/ActivitiesSection.jsx";
import TeamSection from "@/components/public/TeamSection.jsx";
import JoinRequestSection from "@/components/public/JoinRequestSection.jsx";
import PublicFooter from "@/components/public/PublicFooter.jsx";

export default function Home() {
  return (
    <>
      <PublicNavbar />
      <HeroSection />
      <AboutSection />
      <ActivitiesSection />
      <TeamSection />
      <JoinRequestSection />
      <PublicFooter />
    </>
  );
}
