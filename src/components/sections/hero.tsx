"use client";

import React, { useContext } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import data from "@/lib/placeholder-images.json";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";

export default function HeroSection() {
  const heroImage = data.placeholderImages.find(
    (img) => img.id === "hero-illustration"
  );

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
          className="mt-16 sm:mt-24 animation-fade-in-up"
          style={{ animationDelay: "0.8s" }}
        >
          <div className="relative -m-4 rounded-xl bg-gray-900/5 p-4 ring-1 ring-inset ring-gray-900/10 lg:-m-6 lg:rounded-2xl lg:p-6">
            {heroImage && (
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                data-ai-hint={heroImage.imageHint}
                width={1200}
                height={800}
                className="rounded-lg shadow-2xl ring-1 ring-gray-900/10 w-full"
                priority
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
