import { StrictMode, Suspense, createContext, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { resetAuthBoundClientState } from "../../src/lib/auth-session-state";
import { MvHandbookLauncher } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-handbook-launcher";

const Auth = createContext<{ user: { id: string } | null; loading: boolean }>({ user: { id: "reader-one" }, loading: false });
export const useAuthTracking = () => useContext(Auth);

function Fixture() {
  const params = new URLSearchParams(location.search);
  const [userId, setUserId] = useState<string | null>(params.has("guest") ? null : "reader-one");
  const [loading, setLoading] = useState(params.has("loading"));
  const [creating, setCreating] = useState(params.has("creating"));
  const [otherDialog, setOtherDialog] = useState(params.has("other-dialog"));
  return <Auth.Provider value={{ user: userId ? { id: userId } : null, loading }}>
    <main style={{ padding: 30 }}>
      <h1>مشاريع تقييم الآلات</h1>
      <div style={{ background: "#0f172a", padding: 20, display: "flex", gap: 12 }}><Suspense fallback={null}><MvHandbookLauncher autoOpenAllowed={!creating && !otherDialog} /></Suspense><button onClick={() => setCreating(value => !value)}>إنشاء مشروع جديد</button></div>
      {creating && <div role="dialog" aria-label="مشروع جديد"><button onClick={() => setCreating(false)}>إغلاق إنشاء المشروع</button></div>}
      {otherDialog && <div role="dialog" aria-label="إجراء آخر"><button onClick={() => setOtherDialog(false)}>إغلاق الإجراء الآخر</button></div>}
      <button onClick={() => setUserId(value => value === "reader-one" ? "reader-two" : "reader-one")}>تبديل الحساب</button>
      <button onClick={() => setLoading(value => !value)}>تبديل التحميل</button>
      <button onClick={() => { resetAuthBoundClientState(); location.reload(); }}>بدء جلسة جديدة</button>
    </main>
  </Auth.Provider>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
