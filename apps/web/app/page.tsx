import { LandingFaq, LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingFeatures } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero";
import { LandingNav } from "@/components/landing/nav";
import { LandingCta } from "@/components/landing/cta";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main id="main">
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </>
  );
}
