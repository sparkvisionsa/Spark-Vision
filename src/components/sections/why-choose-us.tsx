"use client";

import React, { useContext } from "react";
import { Check } from "lucide-react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import { SectionReveal } from "./section-reveal";

export default function WhyChooseUsSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  return (
    <section id="why-choose-us" className="home-section py-20 md:py-28">
      <div className="container relative">
        <SectionReveal className="mx-auto max-w-5xl text-center">
          <SectionHeading
            title={c.whyChooseUs.title}
            subtitle={c.whyChooseUs.subtitle}
            className="home-section-heading"
          />
        </SectionReveal>
        <div className="mx-auto mt-14 max-w-5xl">
          <dl className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {c.whyChooseUs.features.map((feature, index) => (
              <SectionReveal
                key={feature.name}
                className="h-full"
                delay={80 + index * 75}
              >
                <div className="home-feature-card group flex h-full items-start gap-4 rounded-2xl border bg-card/70 p-5 backdrop-blur-sm sm:p-6">
                  <div className="home-icon-orbit flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <dt className="flex items-center gap-2 text-base font-bold leading-7 text-foreground">
                      <span>{feature.name}</span>
                      <Check className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
                    </dt>
                    <dd className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                      {feature.description}
                    </dd>
                  </div>
                  <span className="relative z-10 hidden text-[10px] font-black tabular-nums text-primary/40 sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              </SectionReveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
