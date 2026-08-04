"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import SparkLogo from "@/app/Spark.jpg";

const VALUE_TECH_PREFIXES = [
  "/value-tech",
  "/real-estate-valuation",
  "/machine-valuation",
  "/evaluation-source",
  "/asset-inventory",
  "/asset-inspection",
  "/clients",
  "/settings",
];

type PageTransitionLoaderProps = {
  variant?: "auto" | "spark" | "value-tech";
};

/**
 * شاشة الانتقال الموحّدة — تُعرض أثناء تحميل المقطع أو الـ dynamic import.
 */
export default function PageTransitionLoader({ variant = "auto" }: PageTransitionLoaderProps) {
  const pathname = usePathname() || "/";
  const isValueTech =
    variant === "value-tech" ||
    (variant === "auto" &&
      VALUE_TECH_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ));

  return (
    <div
      className={`sv-page-loader fixed inset-0 z-[100] flex items-center justify-center ${
        isValueTech ? "sv-page-loader--value-tech" : "sv-page-loader--spark"
      }`}
    >
      <style>{`
        .sv-page-loader--value-tech {
          background:
            radial-gradient(ellipse 90% 55% at 50% -6%, rgba(232, 184, 90, 0.3) 0%, rgba(255, 248, 235, 0.14) 36%, transparent 68%),
            radial-gradient(ellipse 48% 38% at 96% 88%, rgba(201, 150, 58, 0.18) 0%, transparent 72%),
            linear-gradient(180deg, #fff8eb 0%, #fffef9 22%, #ffffff 48%, #fff9ee 78%, #fffef9 100%);
        }
        .sv-page-loader--spark {
          background:
            radial-gradient(ellipse 90% 55% at 50% -6%, rgba(38, 70, 151, 0.22) 0%, rgba(239, 244, 255, 0.5) 38%, transparent 70%),
            radial-gradient(ellipse 48% 38% at 96% 88%, rgba(59, 130, 246, 0.14) 0%, transparent 72%),
            linear-gradient(180deg, #edf3ff 0%, #f8faff 26%, #ffffff 52%, #f2f6ff 100%);
        }
        @keyframes sv-glow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes sv-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        @keyframes sv-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .sv-glow { animation: sv-glow 2s ease-in-out infinite; }
        .sv-bar-track { overflow: hidden; }
        .sv-bar-fill { animation: sv-bar 1.4s ease-in-out infinite; }
        .sv-fade { animation: sv-fade 2s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-7">
        <div className="relative">
          <div
            className={`sv-glow absolute -inset-5 rounded-3xl blur-xl ${
              isValueTech
                ? "bg-gradient-to-br from-[#e8b85a]/28 to-[#c9963a]/16"
                : "bg-gradient-to-br from-[#264697]/30 to-[#60a5fa]/18"
            }`}
          />
          <div
            className={`relative overflow-hidden rounded-2xl border bg-white p-3.5 ${
              isValueTech
                ? "border-[rgba(201,150,58,0.32)] shadow-[0_8px_28px_rgba(168,118,42,0.14)]"
                : "border-[rgba(38,70,151,0.28)] shadow-[0_8px_28px_rgba(38,70,151,0.16)]"
            }`}
          >
            <Image
              src={isValueTech ? "/value-tech-icon.png" : SparkLogo}
              alt=""
              width={72}
              height={72}
              priority
              className={`h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem] ${
                isValueTech ? "object-contain" : "rounded-lg object-cover"
              }`}
              aria-hidden
            />
          </div>
        </div>

        <div className="sv-fade text-center">
          <p
            className={`bg-clip-text text-[1.15rem] font-extrabold tracking-tight text-transparent sm:text-xl ${
              isValueTech
                ? "bg-gradient-to-b from-[#e8b85a] via-[#c9963a] to-[#a8762a]"
                : "bg-gradient-to-b from-[#3157ad] via-[#264697] to-[#183578]"
            }`}
          >
            {isValueTech ? "فاليو تك" : "سبارك فيجن"}
          </p>
          <p
            className={`mt-1 bg-clip-text text-[13px] font-semibold tracking-[0.12em] text-transparent ${
              isValueTech
                ? "bg-gradient-to-b from-[#c9963a] to-[#a8762a]"
                : "bg-gradient-to-b from-[#3157ad] to-[#183578]"
            }`}
          >
            {isValueTech ? "Value Tech" : "Spark Vision"}
          </p>
        </div>

        <div
          className={`sv-bar-track h-[2px] w-40 rounded-full ${
            isValueTech ? "bg-[rgba(201,150,58,0.18)]" : "bg-[rgba(38,70,151,0.18)]"
          }`}
        >
          <div
            className={`sv-bar-fill h-full w-12 rounded-full bg-gradient-to-r from-transparent to-transparent ${
              isValueTech ? "via-[#e8b85a]/85" : "via-[#3157ad]/85"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
