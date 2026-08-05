"use client";

import React, { useContext } from "react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { SectionReveal } from "./section-reveal";

export default function ContactSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];
  const isArabic = language === "ar";

  return (
    <section id="contact" className="home-section home-section-soft py-20 md:py-28">
      <div className="container relative">
        <SectionReveal className="mx-auto max-w-2xl text-center">
          <SectionHeading title={c.contact.title} subtitle={c.contact.subtitle} className="home-section-heading" />
        </SectionReveal>

        <div className="mt-14 grid grid-cols-1 items-stretch gap-7 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionReveal className="mx-auto w-full max-w-xl" delay={100}>
            <div className="home-contact-card h-full rounded-3xl border bg-card/90 p-5 backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Spark Vision</p>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{isArabic ? "قنوات التواصل المباشر" : "Direct contact channels"}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                  <MessageCircle className="h-5 w-5" />
                </span>
              </div>
              <div className="space-y-3">
              <a
                href="tel:+966550545782"
                className="group flex items-center gap-4 rounded-2xl border border-border/80 bg-background/60 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-muted-foreground">{isArabic ? "رقم التواصل" : "Phone"}</span>
                  <span className="mt-1 block font-semibold text-foreground" dir="ltr">+966550545782</span>
                </span>
              </a>

              <a
                href={`https://wa.me/${c.contact.form.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-border/80 bg-background/60 p-4 transition-colors hover:border-[#25D366]/35 hover:bg-[#25D366]/5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#128C4A] transition-transform duration-300 group-hover:scale-105">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-muted-foreground">{isArabic ? "واتساب" : "WhatsApp"}</span>
                  <span className="mt-1 block font-semibold text-foreground">{isArabic ? "ابدأ المحادثة مباشرة" : "Start a conversation"}</span>
                </span>
              </a>

              <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-background/60 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-muted-foreground">{isArabic ? "الموقع" : "Location"}</span>
                  <span className="mt-1 block font-semibold text-foreground">{isArabic ? "الرياض، المملكة العربية السعودية" : "Riyadh, Saudi Arabia"}</span>
                </span>
              </div>
            </div>
            </div>
          </SectionReveal>

          <SectionReveal className="w-full" delay={180}>
            <div className="home-map-frame h-full p-2">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3627.8381350447876!2d46.6953046!3d24.594781799999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e2f0fcb2b754a53%3A0x8b191ed59492134b!2sSuper%20Office!5e0!3m2!1sen!2ssa!4v1763898523770!5m2!1sen!2ssa"
                width="100%"
                height="450"
                className="min-h-[360px] w-full rounded-2xl sm:min-h-[450px]"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                title="Google Maps Location"
              ></iframe>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
