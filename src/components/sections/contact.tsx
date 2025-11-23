"use client";

import React, { useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";
import { MapPin } from "lucide-react";

export default function ContactSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const c = content[language];

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
            <form
              className="space-y-6"
              onSubmit={(e) => e.preventDefault()}
            >
              <div>
                <Label htmlFor="name" className="text-foreground/80">
                  {c.contact.form.name}
                </Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  className="mt-2 bg-background"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-foreground/80">
                  {c.contact.form.email}
                </Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  className="mt-2 bg-background"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="message" className="text-foreground/80">
                  {c.contact.form.message}
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="mt-2 bg-background"
                />
              </div>
              <div className="text-center">
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  {c.contact.form.button}
                </Button>
              </div>
            </form>
          </div>

          <div
            className="w-full animation-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="overflow-hidden rounded-lg">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3168.963333333333!2d-122.0840!3d37.4220!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808fba024255c3df%3A0x495f465f182c6a47!2sGoogleplex!5e0!3m2!1sen!2sus!4v1620833111867!5m2!1sen!2sus"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                title="Google Maps Location"
              ></iframe>
            </div>
            <div className="mt-6 text-center text-muted-foreground">
              <p className="flex items-center justify-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                1600 Amphitheatre Parkway, Mountain View, CA 94043
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
