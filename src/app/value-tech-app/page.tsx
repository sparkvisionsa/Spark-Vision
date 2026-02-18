"use client";

import Image from "next/image";
import Link from "next/link";
import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Download,
  FileSpreadsheet,
  Layers,
  Lock,
  MessageCircle,
  MonitorCheck,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Users,
} from "lucide-react";

const HIDE_VALUE_TECH_APP_PAGE = true;

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
@keyframes magic-glow {
  0% { filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5)) brightness(1); }
  50% { filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8)) brightness(1.2); }
  100% { filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5)) brightness(1); }
}
@keyframes text-shine {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes text-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.02); opacity: 0.9; }
}
@keyframes magic-text-glow {
  0% { text-shadow: 0 0 5px rgba(255, 215, 0, 0.5), 0 0 10px rgba(255, 215, 0, 0.3), 0 0 15px rgba(255, 215, 0, 0.2); }
  50% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.4); }
  100% { text-shadow: 0 0 5px rgba(255, 215, 0, 0.5), 0 0 10px rgba(255, 215, 0, 0.3), 0 0 15px rgba(255, 215, 0, 0.2); }
}
@keyframes magic-bg-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes magic-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-5px) rotate(1deg); }
  50% { transform: translateY(-10px) rotate(0deg); }
  75% { transform: translateY(-5px) rotate(-1deg); }
}
@keyframes floating-particles {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
  25% { transform: translateY(-20px) rotate(90deg); opacity: 1; }
  50% { transform: translateY(-40px) rotate(180deg); opacity: 0.7; }
  75% { transform: translateY(-20px) rotate(270deg); opacity: 1; }
  100% { transform: translateY(0) rotate(360deg); opacity: 0.7; }
}
@keyframes hero-glow {
  0% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.2); }
  50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.5), 0 0 80px rgba(59, 130, 246, 0.3); }
  100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.2); }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
.hero-marketing-text {
  background: linear-gradient(90deg, #ffd700, #ffed4e, #ffd700, #ffed4e, #ffd700);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: text-shine 3s linear infinite, text-pulse 2s ease-in-out infinite;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
  line-height: 1.4;
}
.magic-hero-text {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7, #dda0dd, #98d8c8);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: magic-bg-shift 4s ease infinite, magic-text-glow 2s ease-in-out infinite, magic-float 3s ease-in-out infinite;
  font-size: 2.5rem;
  font-weight: 900;
  font-family: 'Arial Black', 'Impact', sans-serif;
  letter-spacing: 0.1em;
  line-height: 1.2;
  text-transform: uppercase;
  position: relative;
}
.magic-hero-text::before {
  content: '';
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  background: linear-gradient(45deg, rgba(255, 107, 107, 0.3), rgba(78, 205, 196, 0.3), rgba(69, 183, 209, 0.3), rgba(150, 206, 180, 0.3));
  border-radius: 20px;
  z-index: -1;
  animation: magic-bg-shift 4s ease infinite;
}
.magic-hero-container {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 215, 0, 0.1), rgba(255, 107, 107, 0.1));
  backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 215, 0, 0.5);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.3), inset 0 0 30px rgba(255, 255, 255, 0.1);
  animation: magic-glow 3s ease-in-out infinite;
}
.value-hero-slide {
  background-image: url("/background/background.png");
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
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
.magic-icon {
  animation: magic-glow 2s ease-in-out infinite;
}
`;





export default function ValueTechPage() {
  const router = useRouter();
  const context = useContext(LanguageContext);

  useEffect(() => {
    if (HIDE_VALUE_TECH_APP_PAGE) {
      router.replace("/value-tech");
    }
  }, [router]);

  if (HIDE_VALUE_TECH_APP_PAGE) return null;
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
        <section className="relative isolate overflow-hidden bg-[#D1F6FF]">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute left-16 top-16 h-48 w-48 rounded-full bg-amber-400/30 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            {/* Floating Particles */}
            <div className="absolute top-20 left-1/4 w-2 h-2 bg-yellow-400 rounded-full opacity-60 animate-floating-particles" style={{ animationDelay: "0s", animationDuration: "8s" }} />
            <div className="absolute top-32 right-1/3 w-1 h-1 bg-blue-400 rounded-full opacity-70 animate-floating-particles" style={{ animationDelay: "2s", animationDuration: "6s" }} />
            <div className="absolute bottom-40 left-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full opacity-50 animate-floating-particles" style={{ animationDelay: "4s", animationDuration: "10s" }} />
            <div className="absolute top-1/2 right-20 w-1 h-1 bg-green-400 rounded-full opacity-80 animate-floating-particles" style={{ animationDelay: "1s", animationDuration: "7s" }} />
            <div className="absolute bottom-20 left-20 w-2 h-2 bg-purple-400 rounded-full opacity-40 animate-floating-particles" style={{ animationDelay: "3s", animationDuration: "9s" }} />
            {/* Sparkle Effects */}
            <div className="absolute top-16 right-16 w-3 h-3 bg-white rounded-full opacity-90 animate-sparkle" style={{ animationDelay: "0s" }} />
            <div className="absolute bottom-32 left-32 w-2 h-2 bg-yellow-200 rounded-full opacity-80 animate-sparkle" style={{ animationDelay: "1.5s" }} />
            <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-blue-200 rounded-full opacity-70 animate-sparkle" style={{ animationDelay: "3s" }} />
          </div>

          <div className="container relative py-16 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-8 text-blue-900 -mt-16">
                <div className="space-y-4">
                </div>

                <div className="flex justify-center mb-4">
                  <Badge className="bg-slate-900/10 hover:bg-slate-900/10 text-black border border-slate-900/20 backdrop-blur-sm px-8 py-4 text-3xl font-bold flex items-center gap-4 shadow-lg">
                    <Image src="/icon.png" alt={t.iconLabel} width={40} height={40} className="drop-shadow-md" />
                    {t.badge}
                  </Badge>
                </div>

                <div className="text-center max-w-3xl mx-auto px-4">
                  <div className="bg-slate-900/10 backdrop-blur-sm rounded-2xl p-6 border border-slate-900/20 shadow-lg">
                    <div className="grid gap-6 md:grid-cols-3 mb-8">
                      <div className="flex flex-col items-center gap-3 text-slate-900 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                        <ShieldCheck className="h-12 w-12 text-green-400 drop-shadow-lg animate-pulse" />
                        <span className="text-xl font-bold text-center leading-tight">{t.security}</span>
                      </div>
                      <div className="flex flex-col items-center gap-3 text-slate-900 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                        <Rocket className="h-12 w-12 text-blue-400 drop-shadow-lg animate-pulse" />
                        <span className="text-xl font-bold text-center leading-tight">{t.uploadSpeed}</span>
                      </div>
                      <div className="flex flex-col items-center gap-3 text-slate-900 animate-fade-in-up" style={{ animationDelay: "600ms" }}>
                        <Timer className="h-12 w-12 text-yellow-400 drop-shadow-lg animate-pulse" />
                        <span className="text-xl font-bold text-center leading-tight">{t.efficiency}</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 leading-relaxed animate-fade-in-up text-center" style={{ animationDelay: "800ms" }}>
                      {t.cta}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button asChild size="lg" className="bg-green-500 text-white hover:bg-green-600 px-10 py-4 text-lg font-semibold transition-all duration-300">
                    <Link href={`https://wa.me/${t.whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                      {t.requestDemo}
                      <MessageCircle className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="bg-yellow-500 text-black hover:bg-yellow-600 px-10 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                    <Link href="#install">
                      <Download className="mr-2 h-5 w-5" />
                      {t.installApp}
                    </Link>
                  </Button>
                </div>

              </div>
              <div className="relative animate-fade-in-up" style={{ animationDelay: "140ms" }}>
                <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-900/20 bg-slate-900/10 p-6 shadow-2xl backdrop-blur">
                  <div className="flex items-center justify-between text-sm text-slate-900/70">
                    <span className="uppercase tracking-[0.2em]">
                      {t.heroImage}
                    </span>
                    <Badge className="bg-slate-900/15 text-slate-900">
                      {t.desktopPreview}
                    </Badge>
                  </div>
                  <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl border border-slate-900/10">
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
                      className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-slate-900/20 px-4 py-2 text-sm text-slate-900 backdrop-blur transition hover:bg-slate-900/30"
                    >
                      <Play className="h-4 w-4" />
                      {t.watchWorkflow}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-900/10 bg-slate-900/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-900/60">
                        {t.desktopApp}
                      </p>
                      <p className="mt-2 text-sm text-slate-900/80">
                        {t.desktopAppDescription}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-900/10 bg-slate-900/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-900/60">
                        {t.installExperience}
                      </p>
                      <p className="mt-2 text-sm text-slate-900/80">
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

        {/* Simplified Main Section */}
        <section className="relative py-20 lg:py-32 bg-gradient-to-br from-slate-50 via-white to-amber-50">
          <div className="container space-y-16">
            {/* App Overview */}
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-4 py-2 text-sm font-medium">
                {t.desktopApplication}
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
                {t.desktopTitle}
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed">
                {t.focusedContentDescription}
              </p>
              <div className="flex justify-center gap-4 mt-8">
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-4 py-2">
                  {t.focusedContentBadge1}
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2">
                  {t.focusedContentBadge2}
                </Badge>
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2">
                  {t.focusedContentBadge3}
                </Badge>
              </div>
            </div>

            {/* Key Features - Reduced to 4 */}
            <div className="space-y-8">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-slate-900 mb-2">
                  {t.featuresTitle}
                </h3>
                <p className="text-slate-500">{t.trustedWorkflow}</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {featureCards.slice(0, 4).map((feature, index) => (
                  <div
                    key={feature.title}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-600 group-hover:scale-110 transition-transform">
                        <feature.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Simplified How It Works - 3 Steps */}
            <div className="space-y-8">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-slate-900 mb-2">
                  {t.howItWorksTitle}
                </h3>
                <p className="text-slate-500">{t.howItWorksDescription}</p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {workflowSteps.slice(0, 3).map((step, index) => (
                  <div
                    key={step.title}
                    className="text-center space-y-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all animate-fade-in-up"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {index + 1}
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900">
                      {step.title}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Integrated Lead Form */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-12">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">
                    {t.leadTitle}
                  </h3>
                  <p className="text-lg text-slate-600">
                    {t.leadDescription}
                  </p>
                </div>
                <form className="grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-slate-700 font-medium">{t.form.name}</Label>
                      <Input id="name" placeholder={t.form.placeholder.name} className="border-slate-300 focus:border-amber-400" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="company" className="text-slate-700 font-medium">{t.form.company}</Label>
                      <Input id="company" placeholder={t.form.placeholder.company} className="border-slate-300 focus:border-amber-400" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-slate-700 font-medium">{t.form.email}</Label>
                    <Input id="email" type="email" placeholder={t.form.placeholder.email} className="border-slate-300 focus:border-amber-400" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-slate-700 font-medium">{t.form.phone}</Label>
                    <Input id="phone" type="tel" placeholder={t.form.placeholder.phone} className="border-slate-300 focus:border-amber-400" />
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <Label htmlFor="message" className="text-slate-700 font-medium">{t.form.message}</Label>
                    <Textarea
                      id="message"
                      placeholder={t.form.placeholder.message}
                      rows={4}
                      className="border-slate-300 focus:border-amber-400"
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-center">
                    <Button className="bg-gradient-to-r from-amber-400 to-amber-600 text-white hover:from-amber-500 hover:to-amber-700 px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
                      {t.form.button}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
