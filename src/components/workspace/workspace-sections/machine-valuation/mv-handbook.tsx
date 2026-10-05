"use client";

import { Fragment, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, Flag, Lightbulb, List, Search, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { HandbookAlbum, HandbookShot } from "./mv-handbook-album";
import { HANDBOOK_CHAPTERS, HANDBOOK_PAGES, type HandbookPage, type HandbookSpot } from "./mv-handbook-content";
import { playPageTurn } from "./mv-handbook-sound";
import styles from "./mv-handbook.module.css";

const number = (value: number) => value.toLocaleString("ar-SA");

function searchText(value: string) {
  return value.toLowerCase().replace(/powerpoint|باور\s*بوينت/g, "باوربوينت").replace(/word/g, "وورد")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
}

/** Code-native illustration: a friendly field explorer following an open-book road. */
function StoryIllustration({ compact = false }: { compact?: boolean }) {
  return <svg viewBox="0 0 520 340" fill="none" aria-hidden="true" className={compact ? styles.smallIllustration : styles.illustration}>
    <ellipse cx="266" cy="296" rx="213" ry="23" fill="#d5deea" />
    <circle cx="263" cy="156" r="126" fill="#e7f0fc" />
    <circle cx="427" cy="63" r="26" fill="#f6cc73" />
    <path d="M70 92h53m-39-12h25M364 122h61m-48-12h28" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
    <path d="M55 258q94-39 203 5v48q-105-42-203-6z" fill="#1d4e9e" />
    <path d="M258 263q105-44 209-5v47q-107-35-209 6z" fill="#173f86" />
    <path d="M65 245q94-40 193 9v46q-99-45-193-7z" fill="#fffaf0" stroke="#dbceb6" strokeWidth="2" />
    <path d="M258 254q102-46 199-9v48q-95-37-199 7z" fill="#f5ebd8" stroke="#dbceb6" strokeWidth="2" />
    <path d="M104 266q69-18 119 5m72 0q66-23 121-8" stroke="#d9c8a7" strokeWidth="3" strokeLinecap="round" />
    <path d="M325 239c-63-37 99-57 39-97S230 133 250 89" stroke="#edb654" strokeWidth="12" strokeLinecap="round" />
    <path d="M325 239c-63-37 99-57 39-97S230 133 250 89" stroke="#fffaf0" strokeWidth="2" strokeDasharray="5 9" />
    <rect x="126" y="155" width="93" height="79" rx="23" fill="#eeb851" stroke="#80592d" strokeWidth="3" />
    <rect x="139" y="170" width="67" height="45" rx="16" fill="#fff9e8" />
    <circle cx="157" cy="189" r="4" fill="#304f45" /><circle cx="186" cy="189" r="4" fill="#304f45" />
    <path d="M165 200q8 7 15-1" stroke="#304f45" strokeWidth="3" strokeLinecap="round" />
    <path d="M137 161q7-34 36-33 30 1 36 33" fill="#1d4e9e" />
    <path d="M130 161h86m-44-32v24" stroke="#143a7c" strokeWidth="7" strokeLinecap="round" />
    <path d="M127 194l-20 18m110-19 20-19m-90 61-5 18m54-18 7 18" stroke="#80592d" strokeWidth="9" strokeLinecap="round" />
    <path d="M131 254h17m47 0h18" stroke="#1d4e9e" strokeWidth="10" strokeLinecap="round" />
    <rect x="227" y="149" width="36" height="44" rx="5" transform="rotate(15 227 149)" fill="#fffaf0" stroke="#1d4e9e" strokeWidth="2" />
    <path d="m234 163 12 3m-15 7 17 4" stroke="#dcad5a" strokeWidth="3" strokeLinecap="round" />
    <path d="M355 87V35" stroke="#1d4e9e" strokeWidth="4" strokeLinecap="round" /><path d="m357 36 37 8-37 16z" fill="#df866f" />
    <rect x="83" y="109" width="48" height="42" rx="10" transform="rotate(-12 83 109)" fill="#fffaf0" stroke="#cec6b4" />
    <path d="m96 123 6 5 12-15" stroke="#2a66c8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m413 204 3-11 4 11 11 4-11 4-4 11-3-11-11-4zM109 57l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill="#dc9c46" />
    <circle cx="318" cy="47" r="4" fill="#de8a79" /><circle cx="76" cy="215" r="5" fill="#9eb6d8" />
  </svg>;
}

function StepCopy({ text, spots, activeSpot, onSpot, still = false }: { text: string; spots?: HandbookSpot[]; activeSpot: string | null; onSpot: (id: string) => void; still?: boolean }) {
  if (!spots?.length) return text;
  return text.split(/(«[^»]+»)/g).map((part, index) => {
    const quoted = part.match(/^«([^»]+)»$/);
    const spot = quoted ? spots.find(item => item.label === quoted[1]) : undefined;
    if (!spot) return <Fragment key={index}>{part}</Fragment>;
    // Page-turn copies look identical to the live page but expose no controls.
    if (still) return <span key={index} className={styles.mention}>{part}</span>;
    const active = activeSpot === spot.id;
    return <button key={index} type="button" className={styles.mention} data-active={active ? "true" : undefined} aria-pressed={active} aria-label={`إضاءة «${spot.label}» في اللقطة`} onClick={event => { event.stopPropagation(); onSpot(spot.id); }}>{part}</button>;
  });
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
  storageError: boolean;
  userId: string;
  onReturnFocus: () => void;
};

export default function MvHandbook({ open, onOpenChange, hidden, onHiddenChange, storageError, userId, onReturnFocus }: Props) {
  const progressKey = `mv:handbook:page:${userId}`;
  const [index, setIndex] = useState(() => {
    try {
      const saved = sessionStorage.getItem(progressKey);
      return Math.max(0, HANDBOOK_PAGES.findIndex(item => item.id === saved));
    } catch { return 0; }
  });
  const [contents, setContents] = useState(false);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [turning, setTurning] = useState<{ id: string; direction: "next" | "previous"; token: number } | null>(null);
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const [spotNote, setSpotNote] = useState("");
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("mv:handbook:muted") === "1"; } catch { return false; }
  });
  const turnToken = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const screenshotButton = useRef<HTMLButtonElement>(null);
  const zoomTrigger = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const preferenceHintId = useId();
  const contentsId = useId();
  const page = HANDBOOK_PAGES[index];
  const last = index === HANDBOOK_PAGES.length - 1;
  const terms = searchText(query).trim().split(/\s+/).filter(Boolean);
  const matchingPages = HANDBOOK_PAGES.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => {
    const text = searchText([item.title, item.chapter, item.subtitle, item.tip, ...(item.spots ?? []).map(spot => spot.label), ...item.steps.flatMap(step => [step.title, step.text])].join(" "));
    return terms.every(term => text.includes(term));
  });

  function toggleContents(value: boolean) {
    setContents(value);
    requestAnimationFrame(() => {
      if (value) searchInput.current?.focus();
      else pageTitle.current?.focus({ preventScroll: true });
    });
  }

  function showScreenshot() {
    zoomTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setZoom(true);
  }

  useEffect(() => {
    if (!turning) return;
    const timer = window.setTimeout(() => setTurning(current => current?.token === turning.token ? null : current), 1600);
    return () => window.clearTimeout(timer);
  }, [turning]);

  function lightSpot(id: string | null, announce = false) {
    setActiveSpot(id);
    if (!announce || !id) return;
    const label = page.spots?.find(spot => spot.id === id)?.label;
    if (label) setSpotNote(`أُضيء «${label}» في ألبوم اللقطات`);
  }

  function goTo(next: number) {
    if (next < 0 || next >= HANDBOOK_PAGES.length || next === index) return;
    const turn: "next" | "previous" = next > index ? "next" : "previous";
    const leaving = HANDBOOK_PAGES[index];
    setIndex(next);
    setActiveSpot(null);
    setSpotNote("");
    setContents(false);
    setZoom(false);
    try { sessionStorage.setItem(progressKey, HANDBOOK_PAGES[next].id); } catch { /* Optional progress. */ }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setTurning(null);
    else {
      if (!muted) playPageTurn();
      setTurning({ id: leaving.id, direction: turn, token: ++turnToken.current });
    }
    requestAnimationFrame(() => {
      body.current?.scrollTo({ top: 0, behavior: "instant" });
      pageTitle.current?.focus({ preventScroll: true });
    });
  }

  function toggleMuted() {
    setMuted(value => {
      const next = !value;
      try {
        if (next) localStorage.setItem("mv:handbook:muted", "1");
        else localStorage.removeItem("mv:handbook:muted");
      } catch { /* Sound preference is optional. */ }
      return next;
    });
  }

  function renderSpread(item: HandbookPage, interactive: boolean) {
    const pageNo = number((interactive ? index : Math.max(0, HANDBOOK_PAGES.findIndex(entry => entry.id === item.id))) + 1);
    return <div className={styles.spread}>
      <article className={styles.storyPage}>
        <div className={styles.runningHead}><span>{pageNo}</span><span>دليل المستخدم</span></div>
        <div className={styles.eyebrow}><span className={styles.chapterPill}>{item.chapter}</span><span>دورة عمل موثّقة</span><Sparkles size={14} aria-hidden="true" /></div>
        {interactive ? <h2 ref={pageTitle} tabIndex={-1} className={styles.pageTitle}>{item.title}</h2> : <div className={styles.pageTitle}>{item.title}</div>}
        <p className={styles.subtitle}>{item.subtitle}</p>
        {interactive && item.image && <button type="button" className={styles.mobileScreenshotLink} onClick={showScreenshot}><Camera size={15} aria-hidden="true" />شاهد هذه الخطوة في النظام<ArrowLeft size={14} aria-hidden="true" /></button>}
        <ol className={styles.steps}>{item.steps.map((step, stepIndex) => <li key={step.title} data-step-spot={step.spot} data-lit={interactive && step.spot && activeSpot === step.spot ? "true" : undefined} onMouseEnter={() => { if (interactive && step.spot) lightSpot(step.spot); }}>
          <span className={styles.stepNumber}>{number(stepIndex + 1)}</span>
          <div><h3>{step.title}</h3><p><StepCopy text={step.text} spots={item.spots} activeSpot={interactive ? activeSpot : null} onSpot={id => lightSpot(id, true)} still={!interactive} /></p></div>
        </li>)}</ol>
        <aside className={styles.tip}><Lightbulb size={19} aria-hidden="true" /><div><strong>ملاحظة للمراجعة</strong><p><StepCopy text={item.tip} spots={item.spots} activeSpot={interactive ? activeSpot : null} onSpot={id => lightSpot(id, true)} still={!interactive} /></p></div></aside>
        <div className={styles.paperFooter}><span>كتيب تقييم الآلات</span><span>{number((interactive ? index : HANDBOOK_PAGES.findIndex(entry => entry.id === item.id)) + 1)}</span></div>
      </article>
      <section className={`${styles.visualPage} ${!item.image ? styles.cover : ""}`} aria-label={interactive ? "شرح مصوّر" : undefined}>
        <div className={styles.runningHead}><span>دليل المستخدم</span><span>{pageNo}</span></div>
        {!item.image ? <>
          <span className={styles.coverBadge}><Sparkles size={14} aria-hidden="true" />من التهيئة إلى الاعتماد</span>
          <h3 className={styles.coverTitle}>تقارير تقييم<br />{" "}<em>بمعايير مؤسسية.</em></h3>
          <StoryIllustration />
          <div className={styles.journey}><span><BookOpen size={17} />تهيئة</span><i /><span><Check size={17} />إعداد</span><i /><span><Flag size={17} />اعتماد</span></div>
          <p className={styles.coverNote}>{number(HANDBOOK_PAGES.length)} صفحة تغطي دورة العمل كاملة</p>
        </> : <>
          <div className={styles.visualHeading}><span className={styles.photoLabel}>من داخل النظام</span><span className={styles.trainingBadge}>بيانات تجريبية</span></div>
          <figure className={styles.photo}>
            <span className={styles.tape} aria-hidden="true" />
            {interactive ? <HandbookAlbum page={item} failed={failedImage === item.image} activeSpot={activeSpot} onActiveSpot={id => lightSpot(id)} onZoom={showScreenshot} onImageError={() => setFailedImage(item.image!)} onRetry={() => setFailedImage(null)} zoomButtonRef={screenshotButton} /> : <HandbookShot image={item.image} alt="" spots={item.spots} interactive={false} />}
            {interactive && <figcaption>{item.caption}</figcaption>}
          </figure>
          {item.example ? <div className={styles.example}><span>من المتغير إلى المعلومة</span><code dir="ltr">{item.example.before}</code><ArrowLeft size={18} aria-hidden="true" /><strong>{item.example.after}</strong></div> : interactive && <div className={styles.miniStory}><StoryIllustration compact /><div><span className={styles.handwritten}>مسار واضح</span><p>{last ? "اكتمل الدليل. نتمنى لكم عملًا موفقًا." : "توثيق كل مرحلة يسهّل المراجعة والاعتماد."}</p></div></div>}
          {interactive && <div className={styles.visualFooter}><span className={styles.decorativeStar}>✦</span>مرجع تشغيلي لفرق التقييم والمراجعة<span className={styles.decorativeStar}>✦</span></div>}
        </>}
      </section>
    </div>;
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content
        data-mv-handbook-dialog
        dir="rtl" lang="ar" className={`${styles.book} font-system-arabic`}
        style={{ "--index": index, "--pages": HANDBOOK_PAGES.length } as CSSProperties}
        onOpenAutoFocus={event => { event.preventDefault(); pageTitle.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }}
        onPointerDownOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => {
          // Escape belongs to the zoom dialog while a screenshot is enlarged.
          // Handle it here so bubbling cannot close the parent book as well.
          if (zoom) { event.preventDefault(); setZoom(false); return; }
          if (contents) { event.preventDefault(); toggleContents(false); }
        }}
        onKeyDown={event => {
          if (zoom || contents || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if ((event.target as HTMLElement).closest("input, select, textarea, [contenteditable=true]")) return;
          if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index + 1); }
          if (event.key === "ArrowRight") { event.preventDefault(); goTo(index - 1); }
        }}
      >
        <span className={styles.edgeLeft} aria-hidden="true" />
        <span className={styles.edgeRight} aria-hidden="true" />
        <span className={styles.edgeBottom} aria-hidden="true" />
        <div className={styles.sheet}>
        <header className={styles.header}>
          <span className={styles.brandIcon}><BookOpen size={21} aria-hidden="true" /></span>
          <div className={styles.brandText}>
            <Dialog.Title className={styles.bookTitle}>كتيب استخدام نظام تقييم الآلات</Dialog.Title>
            <Dialog.Description className={styles.description}>دليل تنفيذي مصوّر، من التهيئة إلى اعتماد التقرير</Dialog.Description>
          </div>
          <button type="button" className={styles.iconButton} aria-pressed={muted} aria-label={muted ? "تشغيل صوت تقليب الصفحات" : "كتم صوت تقليب الصفحات"} onClick={toggleMuted}>{muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}</button>
          <button type="button" className={styles.contentsButton} aria-label="الفهرس" aria-expanded={contents} aria-controls={contents ? contentsId : undefined} onClick={() => toggleContents(!contents)}><List size={17} aria-hidden="true" /><span>الفهرس</span></button>
          <Dialog.Close className={styles.iconButton} aria-label="إغلاق الكتيب"><X size={19} /></Dialog.Close>
        </header>

        <nav className={styles.chapters} aria-label="فصول الكتيب">
          {HANDBOOK_CHAPTERS.map((chapter, chapterIndex) => <button type="button" key={chapter} aria-current={page.chapter === chapter ? "step" : undefined} onClick={() => goTo(HANDBOOK_PAGES.findIndex(item => item.chapter === chapter))}>
            <span>{number(chapterIndex + 1)}</span>{chapter}
          </button>)}
        </nav>

        <p className={styles.spotNote} role="status">{spotNote}</p>
        {contents ? <div id={contentsId} className={styles.contents}>
          <div className={styles.contentsHeading}><div><span className={styles.eyebrow}>فهرس الدليل</span><h2>الانتقال إلى موضوع محدد</h2></div><button type="button" className={styles.iconButton} onClick={() => toggleContents(false)} aria-label="العودة إلى الصفحة"><X size={18} /></button></div>
          <div className={styles.searchBox}><Search size={17} aria-hidden="true" /><input ref={searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="البحث في الكتيب" placeholder="ابحث عن إجراء أو قالب أو متغير…" />{query && <button type="button" aria-label="مسح البحث" onClick={() => { setQuery(""); searchInput.current?.focus(); }}><X size={16} /></button>}</div>
          {query && <p className={styles.searchSummary} role="status">{matchingPages.length ? `${number(matchingPages.length)} صفحة تتضمن كلمات البحث` : "لا توجد نتائج مطابقة. يُرجى تجربة كلمة أخرى، مثل «قالب» أو «صور»."}</p>}
          <div className={styles.contentsGrid}>{HANDBOOK_CHAPTERS.map(chapter => {
            const matches = matchingPages.filter(({ item }) => item.chapter === chapter);
            return matches.length > 0 && <section key={chapter}><h3>{chapter}</h3>{matches.map(({ item, itemIndex }) => <button type="button" key={item.id} onClick={() => goTo(itemIndex)} aria-current={itemIndex === index ? "page" : undefined}><span>{number(itemIndex + 1).padStart(2, "٠")}</span>{item.title.replace("\n", " ")}<ArrowLeft size={13} aria-hidden="true" /></button>)}</section>;
          })}</div>
        </div> : <div className={styles.body} ref={body}>
          <div className={styles.stage}>
            {renderSpread(page, true)}
            {turning && (() => {
              // A real sheet pivots on the spine: its front is the page being left,
              // its back is the page being reached, and the old facing page stays
              // underneath until the sheet lands on it.
              const leaving = HANDBOOK_PAGES.find(item => item.id === turning.id) ?? page;
              const forward = turning.direction === "next";
              // Arabic book: moving forward lifts the left sheet over to the right.
              const near = forward ? "left" : "right";
              const far = forward ? "right" : "left";
              return <div key={turning.token} className={styles.turn} data-direction={turning.direction} aria-hidden="true">
                <div className={styles.under}><div className={styles.half} data-side={far} dir="rtl" lang="ar">{renderSpread(leaving, false)}</div></div>
                <div className={styles.leaf} onAnimationEnd={event => { if (event.target !== event.currentTarget) return; setTurning(current => current?.token === turning.token ? null : current); }}>
                  <div className={styles.leafFront}><div className={styles.half} data-side={near} dir="rtl" lang="ar">{renderSpread(leaving, false)}</div></div>
                  <div className={styles.leafBack}><div className={styles.half} data-side={far} dir="rtl" lang="ar">{renderSpread(page, false)}</div></div>
                </div>
              </div>;
            })()}
          </div>
        </div>}

        <footer className={styles.footer}>
          <div className={styles.progressRow}><span role="status" aria-live="polite" aria-atomic="true">الصفحة {number(index + 1)} من {number(HANDBOOK_PAGES.length)}<span className={styles.progressTitle}> · {page.chapter}</span></span><div className={styles.progressTrack} role="progressbar" aria-label="تقدم قراءة الكتيب" aria-valuemin={0} aria-valuemax={HANDBOOK_PAGES.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / HANDBOOK_PAGES.length) * 100}%` }} /></div></div>
          <div className={styles.footerActions}>
            <div className={styles.preference}><label><input type="checkbox" checked={hidden} aria-describedby={preferenceHintId} onChange={event => onHiddenChange(event.target.checked)} /><span>عدم الظهور مرة أخرى</span></label><small id={preferenceHintId} role={storageError ? "alert" : undefined}>{storageError ? "تعذر حفظ التفضيل؛ تحقق من السماح بتخزين بيانات الموقع." : "يُحفظ لحسابك في هذا المتصفح. يمكنك فتحه يدويًا دائمًا."}</small></div>
            <div className={styles.pager}><button type="button" className={styles.previous} disabled={index === 0} onClick={() => goTo(index - 1)}><ArrowRight size={16} aria-hidden="true" />السابق</button><button type="button" className={styles.next} onClick={() => last ? onOpenChange(false) : goTo(index + 1)}>{last ? "المباشرة بالعمل" : index === 0 ? "ابدأ الاطلاع" : "التالي"}{last ? <Check size={17} aria-hidden="true" /> : <ArrowLeft size={17} aria-hidden="true" />}</button></div>
          </div>
        </footer>
        </div>

        <Dialog.Root open={zoom} onOpenChange={setZoom}>
          <Dialog.Portal><Dialog.Overlay className={styles.zoomOverlay} /><Dialog.Content dir="rtl" lang="ar" className={`${styles.zoomDialog} font-system-arabic`} onCloseAutoFocus={event => {
            event.preventDefault();
            const target = zoomTrigger.current?.isConnected ? zoomTrigger.current : screenshotButton.current ?? pageTitle.current;
            target?.focus({ preventScroll: true });
          }}>
            <header><Dialog.Title>{page.title}</Dialog.Title><Dialog.Close className={styles.iconButton} aria-label="إغلاق تكبير اللقطة"><X size={20} /></Dialog.Close></header>
            <Dialog.Description>{page.caption}</Dialog.Description>
            <div className={styles.zoomScroll}>{failedImage === page.image || !page.image ? <div className={styles.imageFallback} role="status"><p>تعذر تحميل اللقطة.</p><button type="button" className={styles.previous} onClick={() => setFailedImage(null)}>إعادة تحميل اللقطة</button></div> : <div className={styles.zoomStage}><HandbookShot image={page.image} alt={page.caption ?? page.title} spots={page.spots} activeSpot={activeSpot} onSpot={id => lightSpot(id, true)} onError={() => setFailedImage(page.image!)} /></div>}</div>
            <p>لقطة من النظام ببيانات تدريبية — يمكنك تمرير الصورة على الشاشات الصغيرة.</p>
          </Dialog.Content></Dialog.Portal>
        </Dialog.Root>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
