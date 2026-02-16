"use client";

import React, { useContext } from "react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";

export default function WhyChooseUsSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  return (
    <section id="why-choose-us" className="py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animation-fade-in-up">
            <SectionHeading
              title={c.whyChooseUs.title}
              subtitle={c.whyChooseUs.subtitle}
            />
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-2xl lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {c.whyChooseUs.features.map((feature, index) => (
              <div
                key={feature.name}
                className="relative ps-16 animation-fade-in-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <dt className="text-base font-semibold leading-7 text-foreground">
                  <div className="absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary rtl:right-0 rtl:left-auto">
                    <feature.icon
                      className="h-6 w-6 text-primary-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-muted-foreground">
                  {feature.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
