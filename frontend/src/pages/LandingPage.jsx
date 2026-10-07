import SiteFooter from '../components/SiteFooter';
import SiteNav from '../components/SiteNav';
import About from '../features/landing/About';
import Areas from '../features/landing/Areas';
import CtaBand from '../features/landing/CtaBand';
import Faq from '../features/landing/Faq';
import Hero from '../features/landing/Hero';
import HowItWorks from '../features/landing/HowItWorks';
import Lessons from '../features/landing/Lessons';
import Packages from '../features/landing/Packages';
import Testimonial from '../features/landing/Testimonial';
import TopInstructors from '../features/landing/TopInstructors';
import TrustStrip from '../features/landing/TrustStrip';

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <TrustStrip />
        <Lessons />
        <Packages />
        <About />
        <Areas />
        <HowItWorks />
        <TopInstructors />
        <Testimonial />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
