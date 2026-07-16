import { getMvT, readMvLanguage } from "./mv-i18n";

type MvLoadingListener = () => void;

type MvLoadingEntry = {
  label: string;
  order: number;
};

const listeners = new Set<MvLoadingListener>();
const entries = new Map<symbol, MvLoadingEntry>();
let revision = 0;
let order = 0;

function defaultLoadingLabel() {
  return getMvT(readMvLanguage())("common.loading.projectFetch");
}

function emit() {
  revision += 1;
  for (const listener of listeners) listener();
}

export function beginMvLoading(label?: string) {
  const resolvedLabel = label ?? defaultLoadingLabel();
  const token = Symbol("mv-loading");
  entries.set(token, { label: resolvedLabel, order: ++order });
  emit();

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    if (entries.delete(token)) emit();
  };
}

export function subscribeMvLoading(listener: MvLoadingListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMvLoadingSnapshot() {
  return revision;
}

export function getMvLoadingState() {
  let latest: MvLoadingEntry | null = null;
  for (const entry of entries.values()) {
    if (!latest || entry.order > latest.order) latest = entry;
  }
  return {
    active: entries.size > 0,
    count: entries.size,
    label: latest?.label ?? defaultLoadingLabel(),
  };
}
