"use client";

import React from "react";
import HeroSection from "./components/portfolio/HeroSection";
import MarqueeSection from "./components/portfolio/MarqueeSection";
import AboutSection from "./components/portfolio/AboutSection";
import ServicesSection from "./components/portfolio/ServicesSection";
import ProjectsSection from "./components/portfolio/ProjectsSection";
import TrainCTA from "./components/TrainCTA";
import SplashCursor from "./components/SplashCursor";
import ContactChannels from "./components/ContactChannels";

export default function HomeClient() {
  return (
    <main className="w-full bg-[#0C0C0C] min-h-screen overflow-x-clip text-[#D7E2EA] relative">
      <SplashCursor />
      <HeroSection />
      <MarqueeSection />
      <ServicesSection />
      <ProjectsSection />
      <AboutSection />
      <TrainCTA />
      <ContactChannels onlyModal={true} />
    </main>
  );
}