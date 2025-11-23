"use client";

import React, { useContext } from "react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";

export default function AboutSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  return (
    <section id="about" className="container py-16 md:py-24">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center">
        <div className="animation-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <SectionHeading title={c.about.title} />
        </div>
        <p className="max-w-3xl leading-normal text-muted-foreground sm:text-xl sm:leading-8 animation-fade-in-up" style={{ animationDelay: "0.4s" }}>
          {c.about.description}
        </p>
      </div>
    </section>
  );
}
