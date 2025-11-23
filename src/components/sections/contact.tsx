"use client";

import React, { useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { content } from "@/lib/content";

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

        <div className="mx-auto mt-12 max-w-xl">
          <form
            className="space-y-6 animation-fade-in-up"
            style={{ animationDelay: "0.4s" }}
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
      </div>
    </section>
  );
}
