export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/[0.97]">
      <style>{`
        @keyframes sv-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes sv-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        @keyframes sv-fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .sv-glow { animation: sv-glow 2s ease-in-out infinite; }
        .sv-bar-track { overflow: hidden; }
        .sv-bar-fill { animation: sv-bar 1.4s ease-in-out infinite; }
        .sv-fade { animation: sv-fade 2s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-7">
        {/* Logo with glow ring */}
        <div className="relative">
          <div className="sv-glow absolute -inset-5 rounded-3xl bg-gradient-to-br from-teal-500/20 to-sky-500/20 blur-xl" />
          <div className="relative rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06] backdrop-blur-sm">
            <svg
              width="52"
              height="52"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="ld-bg"
                  x1="0"
                  y1="0"
                  x2="36"
                  y2="36"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#0d9488" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
                <linearGradient
                  id="ld-sh"
                  x1="18"
                  y1="0"
                  x2="18"
                  y2="22"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="white" stopOpacity="0.28" />
                  <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect width="36" height="36" rx="9" fill="url(#ld-bg)" />
              <rect width="36" height="36" rx="9" fill="url(#ld-sh)" />
              <path
                d="M11.5 11L18 26L24.5 11"
                stroke="white"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 7.5L19.2 9.5L18 11.5L16.8 9.5Z"
                fill="white"
                fillOpacity="0.8"
              />
            </svg>
          </div>
        </div>

        {/* Brand name */}
        <p className="text-[15px] font-semibold tracking-tight text-white/70">
          Value Tech
        </p>

        {/* Progress bar */}
        <div className="sv-bar-track h-[2px] w-40 rounded-full bg-white/[0.06]">
          <div className="sv-bar-fill h-full w-12 rounded-full bg-gradient-to-r from-transparent via-teal-400/70 to-transparent" />
        </div>
      </div>
    </div>
  );
}
