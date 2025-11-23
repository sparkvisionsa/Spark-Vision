"use client";

import React, { useContext } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeading } from "../ui/heading";
import data from "@/lib/placeholder-images.json";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";

export default function PortfolioSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  const portfolioImages = {
    "portfolio-1": data.placeholderImages.find(
      (img) => img.id === "portfolio-1"
    ),
    "portfolio-2": data.placeholderImages.find(
      (img) => img.id === "portfolio-2"
    ),
    "portfolio-3": data.placeholderImages.find(
      (img) => img.id === "portfolio-3"
    ),
    "portfolio-4": data.placeholderImages.find(
      (img) => img.id === "portfolio-4"
    ),
  };

  return (
    <section id="portfolio" className="container py-16 md:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <div className="animation-fade-in-up">
          <SectionHeading
            title={c.portfolio.title}
            subtitle={c.portfolio.subtitle}
          />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-2">
        {c.portfolio.projects.map((project, index) => {
          const image = portfolioImages[project.imageId as keyof typeof portfolioImages];
          return (
            <div
              key={project.title}
              className="animation-fade-in-up"
              style={{ animationDelay: `${0.4 + index * 0.1}s` }}
            >
              <Card className="h-full overflow-hidden transition-all hover:shadow-lg">
                <CardHeader className="p-0">
                  {image && (
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      data-ai-hint={image.imageHint}
                      width={600}
                      height={400}
                      className="w-full object-cover"
                    />
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <CardTitle className="text-xl font-semibold">
                    {project.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    {project.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
