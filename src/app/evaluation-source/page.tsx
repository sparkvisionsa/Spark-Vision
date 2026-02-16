import Link from "@/components/prefetch-link";
import { Car, Building2, Shapes, ArrowUpRight } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";

export default function Page() {
  const cards = [
    {
      title: "Cars",
      description: "Browse and evaluate car source data.",
      href: "/evaluation-source/cars",
      icon: Car,
      accent: "from-emerald-100 to-emerald-50 border-emerald-200/70",
    },
    {
      title: "Real Estate",
      description: "Go to real estate evaluation source.",
      href: "/evaluation-source/real-estate",
      icon: Building2,
      accent: "from-amber-100 to-amber-50 border-amber-200/70",
    },
    {
      title: "Other",
      description: "Open other evaluation source categories.",
      href: "/evaluation-source/other",
      icon: Shapes,
      accent: "from-sky-100 to-sky-50 border-sky-200/70",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-900 flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-10 sm:py-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Evaluation Source</h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Choose a category to continue.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`group rounded-3xl border bg-gradient-to-br p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${card.accent}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
                      <Icon className="h-6 w-6 text-slate-700" />
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-slate-500 transition group-hover:text-slate-900" />
                  </div>

                  <h2 className="mt-6 text-xl font-semibold text-slate-900">{card.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
