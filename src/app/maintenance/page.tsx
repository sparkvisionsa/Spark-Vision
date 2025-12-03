"use client";

import { useContext } from "react";
import Image from "next/image";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { LanguageContext } from "@/components/layout-provider";
import { content } from "@/lib/content";
import SparkLogo from "@/app/Spark.jpg";

const animationStyles = `
@keyframes float {
  0% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0); }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export default function MaintenancePage() {
  const langContext = useContext(LanguageContext);

  if (!langContext) {
    return null;
  }

  const { language } = langContext;
  const copy = content[language].maintenance;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-secondary/30">
      <Header navDisabled />
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <style>{animationStyles}</style>
        <section className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-10 shadow-xl backdrop-blur">
          <div className="pointer-events-none absolute -left-24 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-secondary/30 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {copy.badge}
            </span>
            <div
              className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-border/70 bg-background shadow-inner"
              style={{ animation: "float 6s ease-in-out infinite" }}
            >
              <Image
                src={SparkLogo}
                alt="Spark Vision"
                width={96}
                height={96}
                className="h-full w-full object-cover object-center"
                priority
              />
            </div>
            <h1
              className="text-balance text-3xl font-bold sm:text-4xl"
              style={{ animation: "fade-up 0.7s ease both" }}
            >
              {copy.title}
            </h1>
            <p
              className="text-balance text-muted-foreground sm:text-lg"
              style={{ animation: "fade-up 0.9s ease both" }}
            >
              {copy.description}
            </p>
            <p className="text-sm text-muted-foreground/90">{copy.note}</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
