"use client";

import React, { useContext } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { SectionHeading } from "../ui/heading";
import data from "@/lib/placeholder-images.json";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";

export default function TestimonialsSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  const testimonialImages = {
    "testimonial-1": data.placeholderImages.find(
      (img) => img.id === "testimonial-1"
    ),
    "testimonial-2": data.placeholderImages.find(
      (img) => img.id === "testimonial-2"
    ),
    "testimonial-3": data.placeholderImages.find(
      (img) => img.id === "testimonial-3"
    ),
  };

  return (
    <section id="testimonials" className="bg-secondary/30 py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animation-fade-in-up">
            <SectionHeading
              title={c.testimonials.title}
              subtitle={c.testimonials.subtitle}
            />
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-lg grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
          {c.testimonials.items.map((testimonial, index) => {
            const image = testimonialImages[testimonial.imageId as keyof typeof testimonialImages];
            return (
              <div
                key={testimonial.name}
                className="animation-fade-in-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <Card className="flex h-full flex-col">
                  <CardContent className="flex-1 p-6">
                    <blockquote className="text-lg text-foreground">
                      <p>{`“${testimonial.quote}”`}</p>
                    </blockquote>
                  </CardContent>
                  <CardFooter className="bg-muted/50 p-6">
                    <div className="flex items-center gap-x-4 rtl:gap-x-reverse">
                      {image && (
                        <Image
                          className="h-12 w-12 rounded-full"
                          src={image.imageUrl}
                          alt={image.description}
                          data-ai-hint={image.imageHint}
                          width={48}
                          height={48}
                        />
                      )}
                      <div>
                        <div className="font-semibold text-foreground">
                          {testimonial.name}
                        </div>
                        <div className="text-muted-foreground">
                          {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
