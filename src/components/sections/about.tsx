"use client";

import React, { useContext } from "react";
import { Sparkles } from "lucide-react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import { SectionReveal } from "./section-reveal";

export default function AboutSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  return (
    <section id="about" className="home-section home-section-soft py-20 md:py-28">
      <div className="container relative">
        <SectionReveal className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="text-center lg:text-start rtl:lg:text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {language === "ar" ? "ابتكار يصنع الفرق" : "Innovation with purpose"}
              </span>
              <SectionHeading
                title={c.about.title}
                className="home-section-heading mt-5 px-0 text-center lg:text-start [&>h2]:text-4xl [&>h2]:sm:text-5xl"
              />
            </div>

            <div className="home-glass-panel p-7 sm:p-10">
              <div className="relative z-10">
                <div className="mb-6 flex items-center gap-3" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.12)]" />
                  <span className="h-px flex-1 bg-gradient-to-l from-primary/50 via-primary/20 to-transparent" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Spark Vision</span>
                </div>
                <p className="text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
                  {c.about.description}
                </p>
                <div className="mt-8 flex items-center gap-2" aria-hidden="true">
                  <span className="h-1.5 w-16 rounded-full bg-primary" />
                  <span className="h-1.5 w-8 rounded-full bg-primary/35" />
                  <span className="h-1.5 w-2 rounded-full bg-primary/15" />
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
