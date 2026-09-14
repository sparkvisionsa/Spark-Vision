"use client";

import SupportPage from "./support-page";

/** Kept separate from support so screen recordings and development conversations never mix with tickets. */
export default function DeveloperRequestsPage() {
  return <SupportPage mode="developer" />;
}
