import {
  Navbar,
  HeroSection,
  FeaturesSection,
  PricingSection,
  TestimonialsSection,
  FAQSection,
  CTASection,
  Footer,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
