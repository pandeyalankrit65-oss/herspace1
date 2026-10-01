import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AudioLines,
  BatteryMedium,
  Briefcase,
  Calculator,
  Car,
  CheckCircle2,
  ChevronRight,
  Coffee,
  EyeOff,
  FileSignature,
  FileText,
  Hand,
  House,
  LifeBuoy,
  MapPin,
  Mic,
  Navigation,
  NotebookPen,
  Phone,
  Shield,
  Smartphone,
  Timer,
  Trash2,
  UserCheck,
  Users,
  Vibrate,
  WifiOff,
  Footprints,
  Building2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useReveal } from "@/hooks/use-reveal";
import heroImage from "@/assets/hero-safety.jpg";
import { LANGS, useI18n, type Lang } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { EMERGENCY_NUMBER } from "@/lib/api";
import { cn } from "@/lib/utils";

type Icon = typeof Shield;
const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;
const gradientText = "bg-gradient-to-r from-primary to-brand bg-clip-text text-transparent";

// ---------------------------------------------------------------------------------------------
// Hero: a phone showing an SOS in progress, drawn in code (so it's sharp, themed and translated).

const PhoneMock = () => {
  const { t } = useI18n();
  return (
    <div role="img" aria-label={t("home.mock.label")} className="relative w-[15.5rem] sm:w-[17rem]">
      <div aria-hidden className="rounded-[2.4rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-2xl dark:border-neutral-700">
        <div className="overflow-hidden rounded-[2rem] bg-background">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pb-1 pt-2.5 text-[10px] font-semibold text-foreground">
            <span>9:41</span>
            <span className="h-4 w-14 rounded-full bg-neutral-900" />
            <BatteryMedium className="h-3.5 w-3.5" />
          </div>
          {/* alert header */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" /> {t("home.mock.sent")}
            </span>
            <span className="text-[10px] text-muted-foreground">{t("live.justNow")}</span>
          </div>
          {/* map */}
          <div className="relative mx-3 h-32 overflow-hidden rounded-2xl bg-[hsl(var(--primary)/0.06)] ring-1 ring-border">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px),linear-gradient(hsl(var(--border))_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="absolute -left-4 top-14 h-3 w-[130%] -rotate-12 rounded-full bg-card ring-1 ring-border" />
            <div className="absolute left-24 top-0 h-[130%] w-3 rotate-6 rounded-full bg-card ring-1 ring-border" />
            <span className="absolute left-[44%] top-[42%] flex h-5 w-5 items-center justify-center">
              <span className="absolute h-12 w-12 rounded-full bg-destructive/20 motion-safe:animate-ping" />
              <span className="h-4 w-4 rounded-full border-2 border-white bg-destructive shadow" />
            </span>
            <span className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded-xl bg-card/95 p-1.5 shadow-card">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[10px] font-bold">{t("home.cardTitle")}</span>
                <span className="block truncate text-[9px] text-muted-foreground">{t("home.cardText")}</span>
              </span>
            </span>
          </div>
          {/* deliveries */}
          <ul className="space-y-1.5 px-4 pt-3 text-[11px]">
            {["Mom", "Priya"].map((name) => (
              <li key={name} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="font-semibold">{name}</span>
                <span className="truncate text-muted-foreground">· {t("sos.delivery.smsDelivered")}</span>
              </li>
            ))}
          </ul>
          <div className="mx-3 mt-2.5 flex items-center gap-2 rounded-xl bg-success/15 px-3 py-2 text-[11px] font-bold text-foreground ring-1 ring-success/30 motion-safe:animate-fade-in">
            <Navigation className="h-3.5 w-3.5 shrink-0 text-success" /> {t("live.onTheWay", { name: "Mom" })}
          </div>
          <div className="space-y-1 px-4 pt-2.5 text-[10px] text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse" />
              <span className="truncate">{t("rec.recording", { count: 3 })}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <BatteryMedium className="h-3 w-3 shrink-0" /> {t("track.battery", { percent: 62 })}
            </p>
          </div>
          <div className="p-3 pt-3">
            <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[11px] font-bold text-primary-foreground">
              <Shield className="h-3.5 w-3.5" /> {t("live.safe")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Hero = () => {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-28 md:pb-28 md:pt-36">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(55%_50%_at_25%_15%,hsl(var(--primary)/0.16),transparent),radial-gradient(40%_40%_at_85%_30%,hsl(var(--brand)/0.12),transparent)]" />
      <div className="container relative mx-auto grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-7 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-success" /> {t("home.badge")}
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl xl:text-6xl">
            <span className={gradientText}>{t("home.heroTitle1")}</span>
            <br />
            {t("home.heroTitle2")}
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">{t("home.heroText")}</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link to="/sos">
              <Button variant="emergency" size="xl" className="w-full gap-2 sm:w-auto">
                <AlertCircle className="h-5 w-5" />
                {t("home.setUpSos")}
              </Button>
            </Link>
            <Link to="/walk">
              <Button variant="glass" size="xl" className="w-full gap-2 sm:w-auto">
                <Footprints className="h-5 w-5" />
                {t("nav.walk")}
              </Button>
            </Link>
          </div>
          <ul className="flex flex-col items-center gap-2 text-sm font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5 lg:justify-start">
            {(["home.trust1", "home.trust2", "home.trust3"] as MessageKey[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> {t(k)}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {t("home.dangerNow")}{" "}
            <a href={`tel:${EMERGENCY_NUMBER}`} className="font-bold text-destructive underline underline-offset-2">
              {t("common.call", { number: EMERGENCY_NUMBER })}
            </a>
          </p>
        </div>

        {/* Photo with the phone in front of it. */}
        <div className="relative mx-auto flex w-full max-w-xl justify-center lg:justify-end">
          <img
            src={heroImage}
            alt={t("home.heroImageAlt")}
            className="absolute right-0 top-6 hidden aspect-[4/5] w-[68%] rounded-[2rem] object-cover shadow-raised ring-1 ring-border sm:block"
          />
          <div className="relative z-10 sm:mr-[38%] sm:mt-0 lg:mr-[42%]">
            <PhoneMock />
            <div className="absolute bottom-24 left-[calc(100%-1.25rem)] hidden w-max rotate-3 items-center gap-2 rounded-2xl border bg-card p-2.5 pr-4 shadow-card sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Timer className="h-4 w-4" />
              </span>
              <span className="text-left text-xs leading-tight">
                <span className="block font-bold">{t("home.floatTimerTitle")}</span>
                <span className="block text-muted-foreground">{t("home.floatTimerText")}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------------------------
// For every situation: tabs, one per kind of moment, each with the tools that help there.

type Situation = { id: string; icon: Icon; link: string };
const SITUATIONS: Situation[] = [
  { id: "walk", icon: Footprints, link: "/walk" },
  { id: "ride", icon: Car, link: "/walk?type=ride" },
  { id: "meet", icon: Coffee, link: "/walk" },
  { id: "home", icon: House, link: "/help#domestic-violence" },
  { id: "work", icon: Briefcase, link: "/help#work" },
  { id: "online", icon: Smartphone, link: "/help#online" },
];
const sk = (id: string, part: string) => `home.sit.${id}.${part}` as MessageKey;

const Situations = () => {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const s = SITUATIONS[active];
  const Icon = s.icon;

  // Arrow keys move between tabs, as screen-reader users expect.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? SITUATIONS.length - 1 : (active + step + SITUATIONS.length) % SITUATIONS.length;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  };

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="container mx-auto max-w-6xl">
        <div className="reveal mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{t("home.sitKicker")}</p>
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.sitTitle")}</h2>
          <p className="text-lg text-muted-foreground">{t("home.sitText")}</p>
        </div>

        <div role="tablist" aria-label={t("home.sitKicker")} onKeyDown={onKeyDown} className="reveal mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
          {SITUATIONS.map((item, i) => {
            const TabIcon = item.icon;
            const selected = i === active;
            return (
              <button
                key={item.id}
                ref={(el) => (tabs.current[i] = el)}
                id={`sit-tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls="sit-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all sm:rounded-full",
                  selected ? "border-transparent bg-primary text-primary-foreground shadow-raised" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <TabIcon className="h-4 w-4" /> {t(sk(item.id, "tab"))}
              </button>
            );
          })}
        </div>

        <div
          id="sit-panel"
          role="tabpanel"
          aria-labelledby={`sit-tab-${s.id}`}
          key={s.id}
          className="grid overflow-hidden rounded-[2rem] border bg-card shadow-card motion-safe:animate-fade-in md:grid-cols-[1fr_1.25fr]"
        >
          <div className="relative flex flex-col justify-between gap-8 overflow-hidden bg-gradient-to-br from-primary to-brand p-8 text-white md:p-10">
            <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
            <div aria-hidden className="pointer-events-none absolute -right-4 top-10 h-24 w-24 rounded-full bg-white/10" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Icon className="h-7 w-7" />
            </span>
            <div className="relative">
              <h3 className="mb-2 text-2xl font-extrabold md:text-3xl">{t(sk(s.id, "title"))}</h3>
              <p className="text-white/90">{t(sk(s.id, "text"))}</p>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 p-8 md:p-10">
            <ul className="space-y-4">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="text-base">{t(sk(s.id, `p${n}`))}</span>
                </li>
              ))}
            </ul>
            <Link to={s.link} className="group inline-flex items-center gap-1 self-start font-semibold text-primary">
              {t(sk(s.id, "cta"))} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------------------------
// When you can't reach for your phone: the discreet ways to raise an alarm.

const Waveform = () => (
  <span aria-hidden className="flex h-10 items-center gap-1">
    {[0.4, 0.8, 0.55, 1, 0.7, 0.9, 0.45, 0.75, 0.6, 0.95, 0.5, 0.8, 0.4].map((h, i) => (
      <span
        key={i}
        className="w-1.5 origin-center rounded-full bg-primary motion-safe:animate-[wave_1.2s_ease-in-out_infinite]"
        style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms` }}
      />
    ))}
  </span>
);

const MiniCalc = () => (
  <span aria-hidden className="grid w-28 grid-cols-4 gap-1 rounded-xl bg-neutral-900 p-2 font-mono text-[10px] font-bold text-white">
    <span className="col-span-4 mb-1 truncate text-right text-sm">1357</span>
    {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map((k) => (
      <span key={k} className={cn("flex h-4 items-center justify-center rounded", k === "=" ? "bg-destructive" : "bg-white/10")}>
        {k}
      </span>
    ))}
  </span>
);

const RecordingPieces = () => (
  <span aria-hidden className="flex flex-wrap justify-end gap-1.5">
    {["0:10", "0:20", "0:30"].map((t) => (
      <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 font-mono text-xs font-semibold text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive motion-safe:animate-pulse" /> {t}
      </span>
    ))}
  </span>
);

// Laid out for a 3-column grid: wide tiles take two columns, so every row is full.
const DISCREET: Array<{ id: string; icon: Icon; art?: () => JSX.Element; wide?: boolean }> = [
  { id: "voice", icon: Mic, art: Waveform, wide: true },
  { id: "calc", icon: Calculator, art: MiniCalc },
  { id: "shake", icon: Vibrate },
  { id: "hold", icon: Hand },
  { id: "fakecall", icon: Phone },
  { id: "record", icon: AudioLines, art: RecordingPieces, wide: true },
  { id: "offline", icon: WifiOff },
];

const Discreet = () => {
  const { t } = useI18n();
  return (
    <section className="bg-muted/40 px-4 py-16 md:py-24">
      <div className="container mx-auto max-w-6xl">
        <div className="reveal mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{t("home.discreetKicker")}</p>
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.discreetTitle")}</h2>
          <p className="text-lg text-muted-foreground">{t("home.discreetText")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISCREET.map(({ id, icon: Icon, art: Art, wide }, i) => (
            <div
              key={id}
              className={cn("reveal flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-card", wide && "sm:col-span-2 lg:col-span-2")}
              style={delay((i % 3) * 70)}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-brand/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                {Art && <Art />}
              </div>
              <div>
                <h3 className="mb-1 text-lg font-bold">{t(`home.discreet.${id}.title` as MessageKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(`home.discreet.${id}.text` as MessageKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------------------------
// After it happens: report, evidence, complaint, rights.

const AFTER: Array<{ id: string; icon: Icon }> = [
  { id: "report", icon: NotebookPen },
  { id: "evidence", icon: FileText },
  { id: "complaint", icon: FileSignature },
  { id: "rights", icon: LifeBuoy },
];

const AfterIncident = () => {
  const { t } = useI18n();
  return (
    <section className="px-4 py-16 md:py-24">
      <div className="container mx-auto max-w-6xl">
        <div className="reveal mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{t("home.afterKicker")}</p>
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.afterTitle")}</h2>
          <p className="text-lg text-muted-foreground">{t("home.afterText")}</p>
        </div>
        <ol className="relative grid gap-6 md:grid-cols-4">
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 bg-gradient-to-r from-primary/40 via-brand/40 to-primary/40 md:block" />
          {AFTER.map(({ id, icon: Icon }, i) => (
            <li key={id} className="reveal relative text-center" style={delay(i * 90)}>
              <span className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-raised ring-1 ring-border">
                <Icon className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <h3 className="mb-1 text-lg font-bold">{t(`home.after.${id}.title` as MessageKey)}</h3>
              <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t(`home.after.${id}.text` as MessageKey)}</p>
            </li>
          ))}
        </ol>
        <div className="reveal mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/report">
            <Button variant="hero" size="lg" className="w-full gap-2 sm:w-auto">
              <NotebookPen className="h-5 w-5" /> {t("home.afterReport")}
            </Button>
          </Link>
          <Link to="/help">
            <Button variant="glass" size="lg" className="w-full gap-2 sm:w-auto">
              <LifeBuoy className="h-5 w-5" /> {t("nav.help")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------------------------
// Your language: the SOS button in each script; tapping one switches the app.

const LANGUAGE_CARDS: Array<{ code: Lang; sos: string; help: string }> = [
  { code: "en", sos: "Emergency SOS", help: "help" },
  { code: "hi", sos: "आपातकालीन SOS", help: "बचाओ" },
  { code: "ta", sos: "அவசர SOS", help: "உதவி" },
  { code: "bn", sos: "জরুরি SOS", help: "বাঁচাও" },
  { code: "mr", sos: "आपत्कालीन SOS", help: "वाचवा" },
];

const Languages = () => {
  const { t, lang, setLang } = useI18n();
  return (
    <section className="px-4 pb-16 md:pb-24">
      <div className="container mx-auto max-w-6xl">
        <div className="reveal mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{t("home.langKicker")}</p>
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.langTitle")}</h2>
          <p className="text-lg text-muted-foreground">{t("home.langText")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {LANGUAGE_CARDS.map(({ code, sos, help }, i) => {
            const current = code === lang;
            return (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={current}
                onClick={() => setLang(code)}
                className={cn(
                  "reveal flex flex-col items-start gap-3 rounded-3xl border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40",
                  current && "border-primary ring-2 ring-primary/30",
                  i === 4 && "col-span-2 sm:col-span-1"
                )}
                style={delay(i * 60)}
              >
                <span className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-extrabold text-destructive-foreground shadow-sos">{sos}</span>
                <span>
                  <span className="block font-bold">{LANGS[code].label}</span>
                  <span className="block text-sm text-muted-foreground">“{help}”</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------------------------

const STEPS: Array<{ icon: Icon; title: MessageKey; text: MessageKey }> = [
  { icon: Users, title: "home.how1Title", text: "home.how1Text" },
  { icon: Send, title: "home.how2Title", text: "home.how2Text" },
  { icon: AlertCircle, title: "home.how3Title", text: "home.how3Text" },
];

const PROMISES: Array<{ icon: Icon; title: MessageKey; text: MessageKey }> = [
  { icon: UserCheck, title: "home.privacy1Title", text: "home.privacy1Text" },
  { icon: EyeOff, title: "home.privacy2Title", text: "home.privacy2Text" },
  { icon: Trash2, title: "home.privacy3Title", text: "home.privacy3Text" },
];

// For visitors: what HerSpace is, the situations it helps in, and the privacy promise.
const Landing = () => {
  const { t, tr } = useI18n();
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <div className="min-h-screen" ref={revealRef}>
      <Navbar />

      <main>
        <Hero />

        {/* How it works */}
        <section className="px-4 pb-16 md:pb-24">
          <div className="container mx-auto max-w-5xl">
            <div className="reveal mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{t("home.howKicker")}</p>
              <h2 className="text-3xl font-extrabold md:text-4xl">{t("home.howTitle")}</h2>
            </div>
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="reveal relative rounded-3xl border bg-card p-6 shadow-card" style={delay(i * 90)}>
                  <span className="absolute right-5 top-4 text-5xl font-extrabold text-primary/10" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mb-1 text-lg font-bold">{t(title)}</h3>
                  <p className="text-muted-foreground">{t(text)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Situations />
        <Discreet />
        <AfterIncident />
        <Languages />

        {/* Privacy promise */}
        <section className="px-4 pb-16 md:pb-24">
          <div className="reveal container relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[hsl(262_40%_12%)] px-6 py-12 text-white md:px-12 md:py-16">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(338_80%_57%/0.25)] blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[hsl(264_66%_50%/0.35)] blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
              <div>
                <Shield className="mb-4 h-10 w-10 text-[hsl(266_85%_78%)]" />
                <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.privacyTitle")}</h2>
                <p className="text-white/85">{t("home.privacyText")}</p>
                <Link to="/privacy" className="mt-4 inline-block font-semibold text-[hsl(266_85%_82%)] underline underline-offset-4">
                  {t("footer.privacy")}
                </Link>
              </div>
              <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {PROMISES.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(266_85%_78%)]" />
                    <div>
                      <h3 className="font-bold">{t(title)}</h3>
                      <p className="text-sm text-white/80">{t(text)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Corporate Connect teaser */}
        <section className="px-4 pb-16 md:pb-24">
          <Link
            to="/corporate"
            className="reveal container group mx-auto flex max-w-6xl flex-col gap-4 rounded-3xl border bg-card p-6 shadow-card transition-colors hover:border-primary/40 sm:flex-row sm:items-center md:p-8"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">{t("nav.corporate")}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{t("home.comingSoon")}</span>
              </span>
              <span className="block text-muted-foreground">{t("home.corporateText")}</span>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              {t("home.corporateButton")} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </section>

        {/* Final call to action */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 to-brand/10 px-4 py-16 md:py-24">
          <div className="reveal container mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-3xl font-extrabold md:text-4xl">
              {tr("home.ctaTitle", { highlight: <span className={gradientText}>{t("home.ctaHighlight")}</span> })}
            </h2>
            <p className="text-lg text-muted-foreground">{t("home.ctaText")}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/signup">
                <Button variant="hero" size="lg" className="w-full gap-2 sm:w-auto">
                  <Users className="h-5 w-5" />
                  {t("home.ctaSignup")}
                </Button>
              </Link>
              <Link to="/about">
                <Button variant="glass" size="lg" className="w-full sm:w-auto">
                  {t("home.ctaAbout")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
