"use client";

import React, { useContext } from "react";
import { LanguageContext } from "@/components/layout-provider";
import { content } from "@/lib/content";
import Header from "@/components/header";
import HeroSection from "@/components/sections/hero";
import AboutSection from "@/components/sections/about";
import ServicesSection from "@/components/sections/services";
import WhyChooseUsSection from "@/components/sections/why-choose-us";
import PortfolioSection from "@/components/sections/portfolio";
import TestimonialsSection from "@/components/sections/testimonials";
import ContactSection from "@/components/sections/contact";
import Footer from "@/components/footer";

export default function Home() {
  const langContext = useContext(LanguageContext);

  if (!langContext) {
    return null;
  }

  const { language } = langContext;
  const c = content[language];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <HeroSection />
        <AboutSection />
        <ServicesSection />
        <WhyChooseUsSection />
        <PortfolioSection />
        <TestimonialsSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
