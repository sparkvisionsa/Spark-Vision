"use client";

import React, { useContext } from "react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import { MapPin, MessageCircle, Phone } from "lucide-react";

export default function ContactSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];
  const isArabic = language === "ar";

  return (
    <section id="contact" className="py-16 md:py-24 bg-secondary/30">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <div className="animation-fade-in-up">
            <SectionHeading
              title={c.contact.title}
              subtitle={c.contact.subtitle}
            />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-8 items-start">
          <div
            className="mx-auto w-full max-w-xl animation-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-sm">
              <a
                href="tel:+966550545782"
                className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-secondary/50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-[#25D366]/5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C4A]">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-muted-foreground">{isArabic ? "واتساب" : "WhatsApp"}</span>
                  <span className="mt-1 block font-semibold text-foreground">{isArabic ? "ابدأ المحادثة مباشرة" : "Start a conversation"}</span>
                </span>
              </a>

              <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-muted-foreground">{isArabic ? "الموقع" : "Location"}</span>
                  <span className="mt-1 block font-semibold text-foreground">{isArabic ? "الرياض، المملكة العربية السعودية" : "Riyadh, Saudi Arabia"}</span>
                </span>
              </div>
            </div>
          </div>

          <div
            className="w-full animation-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="overflow-hidden rounded-lg">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3627.8381350447876!2d46.6953046!3d24.594781799999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e2f0fcb2b754a53%3A0x8b191ed59492134b!2sSuper%20Office!5e0!3m2!1sen!2ssa!4v1763898523770!5m2!1sen!2ssa"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                title="Google Maps Location"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
