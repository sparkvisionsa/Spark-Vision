/** يُرجع التحكم للمتصفح لتجنّب تجمّد الواجهة أثناء معالجة ملفات Word الكبيرة */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
