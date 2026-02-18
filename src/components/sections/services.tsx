"use client";

import React, { useContext } from "react";
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

export default function ServicesSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];
  const hiddenServiceLinks = new Set(["/value-tech", "/value-tech-app"]);

  return (
    <section id="services" className="py-16 md:py-24 bg-secondary/30">
      <div className="container">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animation-fade-in-up">
            <SectionHeading
              title={c.services.title}
              subtitle={c.services.subtitle}
            />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.services.items.map((service, index) => {
            const serviceHref =
              "href" in service && typeof service.href === "string"
                ? hiddenServiceLinks.has(service.href)
                  ? undefined
                  : service.href
                : undefined;

            const card = (
              <Card
                className={cn(
                  "h-full transform transition-transform duration-300 hover:-translate-y-2 hover:shadow-xl",
                  serviceHref ? "cursor-pointer" : ""
                )}
              >
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <service.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-xl font-semibold">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );

            return (
              <div
                key={service.title}
                className="animation-fade-in-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
