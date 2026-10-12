import { useMemo } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CarFront,
  Cog,
  Cpu,
  Droplets,
  Dumbbell,
  Factory,
  Fuel,
  GraduationCap,
  HardHat,
  HeartPulse,
  Hotel,
  Landmark,
  MapPinned,
  MoonStar,
  Pickaxe,
  Plane,
  RadioTower,
  Ship,
  ShoppingBag,
  Sprout,
  TrainFront,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_ICON_NAMES } from "@/lib/project-icon-names";
import { normalizeProjectIconName, projectIconInitial, projectIconKind, type ProjectIconKind } from "./mv-project-name-icon-kind";
import { projectLibraryIcon, projectMaterialIcon } from "./mv-project-material-icon";

type RecognizedKind = Exclude<ProjectIconKind, "generic">;

const ICONS: Record<RecognizedKind, LucideIcon> = {
  airport: Plane,
  ship: Ship,
  rail: TrainFront,
  health: HeartPulse,
  education: GraduationCap,
  factory: Factory,
  warehouse: Warehouse,
  fuel: Fuel,
  energy: Zap,
  water: Droplets,
  farm: Sprout,
  hotel: Hotel,
  restaurant: UtensilsCrossed,
  retail: ShoppingBag,
  finance: Landmark,
  office: BriefcaseBusiness,
  telecom: RadioTower,
  technology: Cpu,
  construction: HardHat,
  vehicle: CarFront,
  transport: Truck,
  religious: MoonStar,
  residential: Building2,
  land: MapPinned,
  sports: Dumbbell,
  machinery: Cog,
  mining: Pickaxe,
};

const TONES = {
  cyan: "border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-sky-100 text-cyan-700 group-hover:shadow-cyan-200/70",
  blue: "border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 group-hover:shadow-blue-200/70",
  emerald: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 group-hover:shadow-emerald-200/70",
  amber: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700 group-hover:shadow-amber-200/70",
  rose: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-pink-100 text-rose-700 group-hover:shadow-rose-200/70",
  violet: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-purple-100 text-violet-700 group-hover:shadow-violet-200/70",
  slate: "border-slate-200 bg-gradient-to-br from-slate-50 to-slate-200 text-slate-700 group-hover:shadow-slate-200/70",
} as const;

const KIND_TONES: Record<RecognizedKind, keyof typeof TONES> = {
  airport: "cyan",
  ship: "blue",
  rail: "blue",
  health: "rose",
  education: "violet",
  factory: "slate",
  warehouse: "amber",
  fuel: "amber",
  energy: "amber",
  water: "cyan",
  farm: "emerald",
  hotel: "violet",
  restaurant: "rose",
  retail: "rose",
  finance: "blue",
  office: "blue",
  telecom: "violet",
  technology: "violet",
  construction: "amber",
  vehicle: "slate",
  transport: "cyan",
  religious: "emerald",
  residential: "blue",
  land: "emerald",
  sports: "rose",
  machinery: "slate",
  mining: "amber",
};

const FALLBACK_TONES: Array<keyof typeof TONES> = ["blue", "emerald", "violet", "cyan", "amber", "rose"];
const LIBRARY_ICON_NAMES = new Set<string>(PROJECT_ICON_NAMES);

function fallbackTone(name: string): keyof typeof TONES {
  const hash = Array.from(normalizeProjectIconName(name)).reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, 0);
  return FALLBACK_TONES[hash % FALLBACK_TONES.length]!;
}

export function MvProjectNameIcon({ name }: { name: string }) {
  const { dynamicName, Icon, tone } = useMemo(() => {
    const material = projectMaterialIcon(name);
    const dynamicName = material?.icon ?? projectLibraryIcon(name, LIBRARY_ICON_NAMES);
    const kind = projectIconKind(name);
    return {
      dynamicName,
      Icon: kind === "generic" ? null : ICONS[kind],
      tone: material?.tone ?? (kind === "generic" ? fallbackTone(name) : KIND_TONES[kind]),
    };
  }, [name]);
  const initial = <span className="relative text-sm font-black leading-none">{projectIconInitial(name)}</span>;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md",
        TONES[tone],
      )}
    >
      <span className="pointer-events-none absolute inset-x-1 top-0 h-px bg-white/80" />
      {dynamicName ? (
        <svg className="relative h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <use href={`/project-icons.svg#${dynamicName}`} />
        </svg>
      ) : Icon ? <Icon className="relative h-[18px] w-[18px]" strokeWidth={1.8} /> : initial}
    </span>
  );
}
