"use client";

import React, { useContext } from "react";
import { ArrowUpLeft } from "lucide-react";
import Link from "@/components/prefetch-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import { cn } from "@/lib/utils";
import { SectionReveal } from "./section-reveal";

export default function ServicesSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

  return (
    <section id="services" className="home-section home-section-soft py-20 md:py-28">
      <div className="container relative">
        <SectionReveal className="mx-auto max-w-5xl text-center">
            <SectionHeading
              title={c.services.title}
              subtitle={c.services.subtitle}
              className="home-section-heading"
            />
        </SectionReveal>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.services.items.map((service, index) => {
            const serviceHref =
              "href" in service && typeof service.href === "string"
                ? service.href
                : undefined;

            const card = (
              <Card
                className={cn(
                  "home-service-card group h-full rounded-2xl bg-card/90 p-1 backdrop-blur-sm",
                  serviceHref ? "cursor-pointer" : "",
                )}
              >
                <CardHeader className="relative z-10 pb-3">
                  <div className="home-icon-orbit mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-500 group-hover:scale-105">
                    <service.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 flex h-[calc(100%-8rem)] flex-col pt-1">
                  <CardDescription className="text-base leading-7">
                    {service.description}
                  </CardDescription>
                  <div className="mt-auto flex items-center justify-between pt-7 text-xs font-bold text-primary">
                    <span>{serviceHref ? (language === "ar" ? "استكشف الخدمة" : "Explore service") : (language === "ar" ? "حلول مصممة لك" : "Built for your needs")}</span>
                    {serviceHref ? <ArrowUpLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-primary/50" aria-hidden="true" />}
                  </div>
                </CardContent>
              </Card>
            );

            return (
              <SectionReveal
                key={service.title}
                className="h-full"
                delay={80 + index * 70}
              >
                {serviceHref ? (
                  <Link
                    href={serviceHref}
                    className="block h-full"
                    aria-label={service.title}
                  >
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </SectionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
