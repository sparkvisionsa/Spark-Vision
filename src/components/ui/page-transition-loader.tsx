"use client";

import Image from "next/image";

/**
 * شاشة الانتقال الموحّدة — تُعرض أثناء تحميل المقطع أو الـ dynamic import.
 */
export default function PageTransitionLoader() {
  return (
    <div className="sv-page-loader fixed inset-0 z-[100] flex items-center justify-center">
      <style>{`
        .sv-page-loader {
          background:
            radial-gradient(ellipse 90% 55% at 50% -6%, rgba(232, 184, 90, 0.3) 0%, rgba(255, 248, 235, 0.14) 36%, transparent 68%),
            radial-gradient(ellipse 48% 38% at 96% 88%, rgba(201, 150, 58, 0.18) 0%, transparent 72%),
            linear-gradient(180deg, #fff8eb 0%, #fffef9 22%, #ffffff 48%, #fff9ee 78%, #fffef9 100%);
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
          <div className="sv-glow absolute -inset-5 rounded-3xl bg-gradient-to-br from-[#e8b85a]/28 to-[#c9963a]/16 blur-xl" />
          <div className="relative rounded-2xl border border-[rgba(201,150,58,0.32)] bg-white p-3.5 shadow-[0_8px_28px_rgba(168,118,42,0.14)]">
            <Image
              src="/value-tech-icon.png"
              alt=""
              width={72}
              height={72}
              priority
              className="h-14 w-14 object-contain sm:h-[3.75rem] sm:w-[3.75rem]"
              aria-hidden
            />
          </div>
        </div>

        <div className="sv-fade text-center">
          <p className="bg-gradient-to-b from-[#e8b85a] via-[#c9963a] to-[#a8762a] bg-clip-text text-[1.15rem] font-extrabold tracking-tight text-transparent sm:text-xl">
            فاليو تك
          </p>
          <p className="mt-1 bg-gradient-to-b from-[#c9963a] to-[#a8762a] bg-clip-text text-[13px] font-semibold tracking-[0.12em] text-transparent">
            Value Tech
          </p>
        </div>

        <div className="sv-bar-track h-[2px] w-40 rounded-full bg-[rgba(201,150,58,0.18)]">
          <div className="sv-bar-fill h-full w-12 rounded-full bg-gradient-to-r from-transparent via-[#e8b85a]/85 to-transparent" />
        </div>
      </div>
    </div>
  );
}
