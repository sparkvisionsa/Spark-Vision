"use client";

import type { CSSProperties } from "react";

type HeroParticleLanguage = "ar" | "en";

type HeroParticleDefinition = {
  x: string;
  y: string;
  delay: string;
  duration: string;
  color: string;
  word: { ar: string; en: string };
};

type HeroSmokePuff = {
  burstX: string;
  burstY: string;
  wordX: string;
  wordY: string;
  size: string;
};

const particles: HeroParticleDefinition[] = [
  { x: "9%", y: "18%", delay: "-1s", duration: "18s", color: "#155eef", word: { ar: "تقنية", en: "TECH" } },
  { x: "91%", y: "21%", delay: "-4s", duration: "18s", color: "#0f766e", word: { ar: "برمجة", en: "CODE" } },
  { x: "9%", y: "53%", delay: "-7s", duration: "18s", color: "#4338ca", word: { ar: "حلول", en: "SOLUTIONS" } },
  { x: "91%", y: "54%", delay: "-10s", duration: "18s", color: "#0369a1", word: { ar: "ذكاء", en: "AI" } },
  { x: "16%", y: "81%", delay: "-13s", duration: "18s", color: "#1d4ed8", word: { ar: "أتمتة", en: "AUTOMATION" } },
  { x: "84%", y: "81%", delay: "-16s", duration: "18s", color: "#0e7490", word: { ar: "نمو", en: "GROWTH" } },
];

const smokePuffs: HeroSmokePuff[] = [
  { burstX: "-3.1rem", burstY: "-1.8rem", wordX: "-2.15rem", wordY: "-0.28rem", size: "0.46rem" },
  { burstX: "-1.45rem", burstY: "-3.25rem", wordX: "-1.55rem", wordY: "0.25rem", size: "0.38rem" },
  { burstX: "0.75rem", burstY: "-3.05rem", wordX: "-0.92rem", wordY: "-0.2rem", size: "0.52rem" },
  { burstX: "2.9rem", burstY: "-1.55rem", wordX: "-0.3rem", wordY: "0.26rem", size: "0.42rem" },
  { burstX: "3.3rem", burstY: "1.35rem", wordX: "0.34rem", wordY: "-0.24rem", size: "0.56rem" },
  { burstX: "1.7rem", burstY: "3.1rem", wordX: "0.92rem", wordY: "0.22rem", size: "0.4rem" },
  { burstX: "-1.15rem", burstY: "3.2rem", wordX: "1.52rem", wordY: "-0.2rem", size: "0.48rem" },
  { burstX: "-3.2rem", burstY: "1.35rem", wordX: "2.12rem", wordY: "0.18rem", size: "0.36rem" },
];

export default function HeroKeywordParticles({ language }: { language: HeroParticleLanguage }) {
  return (
    <div className="hero-keyword-particles" aria-hidden="true">
      <div className="hero-keyword-particles-glow" />
      {particles.map((particle) => {
        const style = {
          left: particle.x,
          top: particle.y,
          "--hero-particle-color": particle.color,
          "--hero-particle-delay": particle.delay,
          "--hero-particle-duration": particle.duration,
        } as CSSProperties;

        return (
          <div key={`${particle.x}-${particle.y}`} className="hero-keyword-particle" style={style}>
            <span className="hero-keyword-particle-orb" />
            <span className="hero-keyword-particle-smoke">
              {smokePuffs.map((smokePuff, index) => {
                const smokeStyle = {
                  "--hero-smoke-burst-x": smokePuff.burstX,
                  "--hero-smoke-burst-y": smokePuff.burstY,
                  "--hero-smoke-word-x": smokePuff.wordX,
                  "--hero-smoke-word-y": smokePuff.wordY,
                  "--hero-smoke-size": smokePuff.size,
                } as CSSProperties;

                return <span key={index} className="hero-keyword-particle-smoke-puff" style={smokeStyle} />;
              })}
            </span>
            <span className="hero-keyword-particle-word" dir={language === "ar" ? "rtl" : undefined}>
              {particle.word[language]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
