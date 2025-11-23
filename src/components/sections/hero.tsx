"use client";

import React, { useContext } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import data from "@/lib/placeholder-images.json";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import type { PlaceholderImage } from "@/lib/types";

export default function HeroSection() {
  const heroImage = data.placeholderImages.find(
    (img) => img.id === "hero-illustration"
  ) as PlaceholderImage | undefined;

  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  return (
    <section className="relative overflow-hidden py-20 md:py-32 lg:py-40">
      <div className="tech-pattern" />
      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="animation-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl font-headline">
              {c.hero.headline}
            </h1>
          </div>
          <p
            className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl animation-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            {c.hero.subtext}
          </p>
          <div
            className="mt-10 flex items-center justify-center gap-x-6 animation-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <Button asChild size="lg">
              <Link href="#contact">{c.hero.cta}</Link>
            </Button>
          </div>
        </div>
        <div
          className="mt-16 sm:mt-24 animation-fade-in-up h-screen"
          style={{ animationDelay: "0.8s" }}
        >
          <div className="relative h-full w-full rounded-none bg-gray-900/5 ring-1 ring-inset ring-gray-900/10">
            {/* Overlay text positioned on top of the image/video */}
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className=" text-white px-5 py-3 rounded-full backdrop-blur-sm shadow-lg animate-slide-in-up">
                <span className="text-2xl md:text-3xl font-semibold">
                 Spark Vision: Cutting-Edge Technology Powering Innovation <br /> and Driving the Next Generation of Digital Transformation.
                </span>
              </div>
            </div>
            {heroImage && (
              // If a videoUrl is provided in the placeholder data, render a video
              // otherwise fall back to the existing image.
              heroImage.videoUrl ? (
                <div className="h-full w-full overflow-hidden rounded-none shadow-2xl ring-1 ring-gray-900/10">
                  <video
                    src={heroImage.videoUrl}
                    poster={heroImage.imageUrl}
                    className="w-full h-full block object-cover"
                    autoPlay
                    playsInline
                    muted
                    loop
                    controls={false}
                  />
                </div>
              ) : (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  data-ai-hint={heroImage.imageHint}
                  width={1200}
                  height={800}
                  className="rounded-none shadow-2xl ring-1 ring-gray-900/10 w-full h-full object-cover"
                  priority
                />
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
