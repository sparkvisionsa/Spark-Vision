"use client";

import Image from "next/image";
import Link from "next/link";
import { useContext } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LanguageContext } from "@/components/layout-provider";
import { content } from "@/lib/content";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Layers,
  Lock,
  MonitorCheck,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Users,
} from "lucide-react";

const animationStyles = `
@keyframes hero-slide {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes float-soft {
  0% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}
@keyframes shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
.value-hero-slide {
  background-image: url("/background/background.png");
  background-size: 130%;
  background-position: 0% 50%;
  animation: hero-slide 20s ease-in-out infinite;
}
.value-float {
  animation: float-soft 6s ease-in-out infinite;
}
.value-shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.2) 45%, transparent 60%);
  transform: translateX(-120%);
  animation: shimmer 3.5s linear infinite;
}
`;





export default function ValueTechPage() {
  const context = useContext(LanguageContext);
  if (!context) return null;
  const { language } = context;
  const t = content.valueTech[language];

  const featureCards = [
    {
      icon: Timer,
      title: t.featureCards[0].title,
      description: t.featureCards[0].description,
    },
    {
      icon: ShieldCheck,
      title: t.featureCards[1].title,
      description: t.featureCards[1].description,
    },
    {
      icon: FileSpreadsheet,
      title: t.featureCards[2].title,
      description: t.featureCards[2].description,
    },
    {
      icon: Layers,
      title: t.featureCards[3].title,
      description: t.featureCards[3].description,
    },
    {
      icon: CloudUpload,
      title: t.featureCards[4].title,
      description: t.featureCards[4].description,
    },
    {
      icon: BadgeCheck,
      title: t.featureCards[5].title,
      description: t.featureCards[5].description,
    },
  ];

  const trustIndicators = [
    {
      icon: Lock,
      title: t.trustItems[0].title,
      description: t.trustItems[0].description,
    },
    {
      icon: MonitorCheck,
      title: t.trustItems[1].title,
      description: t.trustItems[1].description,
    },
    {
      icon: Rocket,
      title: t.trustItems[2].title,
      description: t.trustItems[2].description,
    },
  ];

  const workflowSteps = t.workflowSteps;
  const installSteps = t.installSteps;
  const testimonials = t.testimonials;
  const stats = t.stats;

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-slate-900">
      <style>{animationStyles}</style>
      <Header />
      <main className="font-value-tech">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 value-hero-slide" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-900/30" />
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute left-16 top-16 h-48 w-48 rounded-full bg-amber-400/30 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          </div>
          <div className="container relative py-16 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-8 text-white animate-fade-in-up" style={{ animationDelay: "80ms" }}>
                <div className="flex items-center gap-3">
                  <Badge className="bg-white/10 text-white hover:bg-white/20">
                    {t.badge}
                  </Badge>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 p-1">
                    <Image
                      src="/background/icon.png"
                      alt="Value Tech icon"
                      width={36}
                      height={36}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm uppercase tracking-[0.3em] text-white/70">
                    {t.headline}
                  </p>
                  <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
                    {t.headline}
                  </h1>
                </div>
                <div className="space-y-4 text-lg text-white/80">
                  <p className="text-sm uppercase tracking-[0.3em] text-white/70">
                    {t.subheading}
                  </p>
                  <p className="max-w-xl text-lg text-white/85">
                    {t.description}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-white/85 backdrop-blur">
                  <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                    {t.focusedContent}
                  </p>
                  <p className="mt-3 text-lg">
                    {t.mission}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Button asChild size="lg" className="bg-amber-400 text-slate-900 hover:bg-amber-300">
                    <Link href="#lead">
                      {t.requestDemo}
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                    <Link href="#install">{t.installApp}</Link>
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {t.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur"
                    >
                      <p className="text-2xl font-semibold text-white">{stat.value}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative animate-fade-in-up" style={{ animationDelay: "140ms" }}>
                <div className="value-float relative overflow-hidden rounded-[2.5rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span className="uppercase tracking-[0.2em]">
                      {t.heroImage}
                    </span>
                    <Badge className="bg-white/15 text-white">
                      {t.desktopPreview}
                    </Badge>
                  </div>
                  <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
                    <Image
                      src="/background/background.png"
                      alt="Value Tech interface preview"
                      fill
                      className="object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/70 via-transparent to-transparent" />
                    <button
                      type="button"
                      className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white backdrop-blur transition hover:bg-white/30"
                    >
                      <Play className="h-4 w-4" />
                      {t.watchWorkflow}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                        {t.desktopApp}
                      </p>
                      <p className="mt-2 text-sm text-white/80">
                        {t.desktopAppDescription}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                        {t.installExperience}
                      </p>
                      <p className="mt-2 text-sm text-white/80">
                        {t.installExperienceDescription}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-amber-400/30 blur-2xl" />
              </div>
            </div>
          </div>
        </section>

        <section id="desktop" className="relative py-16 lg:py-24">
          <div className="tech-pattern" />
          <div className="container grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <Badge className="bg-slate-900 text-amber-200 hover:bg-slate-800">
                {t.desktopApplication}
              </Badge>
              <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                {t.desktopTitle}
              </h2>
              <p className="text-lg text-slate-600">
                {t.desktopDescription}
              </p>
              <div className="space-y-3">
                {t.benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-amber-500" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="value-shimmer relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                    {t.focusedContent}
                  </p>
                </div>
                <p className="mt-4 text-lg text-slate-700">
                  {t.focusedContentDescription}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                    {t.focusedContentBadge1}
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                    {t.focusedContentBadge2}
                  </Badge>
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                    {t.focusedContentBadge3}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CloudUpload className="h-5 w-5 text-cyan-500" />
                    <span className="text-sm font-medium">{t.liveUploads}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {t.liveUploadsDescription}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">{t.secureAccess}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {t.secureAccessDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-16 lg:py-24">
          <div className="container space-y-10">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                {t.howItWorks}
              </p>
              <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                {t.howItWorksTitle}
              </h2>
              <p className="text-lg text-slate-600">
                {t.howItWorksDescription}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md animate-fade-in-up"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-600">
                      Step {index + 1}
                    </span>
                    <span className="h-10 w-10 rounded-full bg-white text-center text-lg font-semibold text-slate-700 shadow">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-16 lg:py-24">
          <div className="container space-y-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                  {t.benefitsAndFeatures}
                </p>
                <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                  {t.featuresTitle}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Star className="h-4 w-4 text-amber-500" />
                {t.trustedWorkflow}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((feature, index) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md animate-fade-in-up"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="relative py-16 lg:py-24">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-100/40 via-white to-cyan-100/40" />
          <div className="container relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <Badge className="bg-slate-900 text-amber-200 hover:bg-slate-800">
                {t.installTheApp}
              </Badge>
              <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                {t.installTitle}
              </h2>
              <p className="text-lg text-slate-600">
                {t.installDescription}
              </p>
              <div className="grid gap-4">
                {installSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm animate-fade-in-up"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <p className="text-sm font-semibold text-amber-600">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                  {t.callToAction}
                </p>
                <h3 className="mt-4 text-2xl font-semibold text-slate-900">
                  {t.ctaTitle}
                </h3>
                <p className="mt-3 text-sm text-slate-600">
                  {t.ctaDescription}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
                    <Link href="#lead">{t.bookOnboarding}</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-slate-300">
                    <Link href="#how-it-works">{t.viewWorkflow}</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-amber-300" />
                  <p className="text-sm uppercase tracking-[0.3em] text-amber-200">
                    {t.socialProof}
                  </p>
                </div>
                <p className="mt-4 text-2xl font-semibold">
                  {t.socialProofTitle}
                </p>
                <p className="mt-3 text-sm text-white/70">
                  {t.socialProofDescription}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="lead" className="bg-white py-16 lg:py-24">
          <div className="container grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                {t.leadCaptureForm}
              </p>
              <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                {t.leadTitle}
              </h2>
              <p className="text-lg text-slate-600">
                {t.leadDescription}
              </p>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <p className="text-sm text-slate-600">
                    {t.respondNote}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {t.onboardingSpecialist}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {t.customTemplates}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {t.training}
                  </div>
                </div>
              </div>
            </div>
            <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t.form.name}</Label>
                  <Input id="name" placeholder={t.form.placeholder.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">{t.form.company}</Label>
                  <Input id="company" placeholder={t.form.placeholder.company} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t.form.email}</Label>
                  <Input id="email" type="email" placeholder={t.form.placeholder.email} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">{t.form.phone}</Label>
                  <Input id="phone" type="tel" placeholder={t.form.placeholder.phone} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">{t.form.message}</Label>
                  <Textarea
                    id="message"
                    placeholder={t.form.placeholder.message}
                    rows={4}
                  />
                </div>
                <Button className="bg-amber-400 text-slate-900 hover:bg-amber-300">
                  {t.form.button}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section id="social-proof" className="py-16 lg:py-24">
          <div className="container space-y-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                  {t.socialProof}
                </p>
                <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                  {t.trustedByTeams}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Users className="h-4 w-4 text-amber-500" />
                {t.builtForBusyTeams}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up"
                >
                  <p className="text-lg text-slate-700">"{testimonial.quote}"</p>
                  <div className="mt-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-slate-500">{testimonial.role}</p>
                    </div>
                    <Star className="h-5 w-5 text-amber-400" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"
                >
                  <p className="text-2xl font-semibold text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="bg-white py-16 lg:py-24">
          <div className="container space-y-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                  {t.trustIndicators}
                </p>
                <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                  {t.trustTitle}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Lock className="h-4 w-4 text-amber-500" />
                {t.securityFirst}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {trustIndicators.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 animate-fade-in-up"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
