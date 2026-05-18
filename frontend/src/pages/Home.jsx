import '../styles/public.css';
import Navbar from '../components/Navbar';
import AboutSection from '../components/AboutSection';
import ActivitiesSection from '../components/ActivitiesSection';
import JoinRequestSection from '../components/JoinRequestSection';
import Footer from '../components/Footer';

function Home() {
  return (
    <div>
      <Navbar />
      <AboutSection />
      <ActivitiesSection />
      <JoinRequestSection />
      <Footer />
    </div>
  );
}

export default Home;