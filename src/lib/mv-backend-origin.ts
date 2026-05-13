/**
 * أصل خادم Nest لطلبات الـ proxy في ‎`/api/mv/*`‎ (بدون لاحقة ‎`/api`‎ في العنوان).
 * إذا وُضع في ‎.env‎ مثلًا ‎BACKEND_URL=http://host:5000/api‎ فإن الوكيل كان يذهب إلى ‎`/api/api/mv/...`‎ فيعيد 404.
 *
 * على DigitalOcean (أو Docker) عندما يعمل Next وNest في حاويتين، ‎127.0.0.1‎ لا يصل إلى Nest؛
 * عيّن ‎MV_INTERNAL_API_ORIGIN‎ (مثلاً ‎http://اسم-الخدمة:5000‎) أو ‎BACKEND_URL‎ لعنوان Nest الفعلي.
 */
export function mvBackendOriginForProxy(): string {
  const raw =
    process.env.MV_INTERNAL_API_ORIGIN?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  const base = raw.replace(/\/+$/, "") || "http://127.0.0.1:5000";
  return base.replace(/\/?api$/i, "").replace(/\/+$/, "") || "http://127.0.0.1:5000";
}
