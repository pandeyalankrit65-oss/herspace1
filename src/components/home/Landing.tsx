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
  Footprints,
  Hand,
  House,
  LifeBuoy,
  MapPin,
  Mic,
  Navigation,
  NotebookPen,
  Phone,
  Send,
  Shield,
  Smartphone,
  Trash2,
  UserCheck,
  Users,
  Vibrate,
  WifiOff,
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

// Every section opens the same way: a small kicker, a large heading and one line of text,
// with plenty of room around them.
const SectionHeader = ({ kicker, title, text, light }: { kicker: string; title: React.ReactNode; text?: string; light?: boolean }) => (
  <div className="reveal mx-auto mb-12 max-w-3xl text-center md:mb-20">
    <p className={cn("mb-4 text-xs font-bold uppercase tracking-[0.14em] md:text-sm", light ? "text-[hsl(266_85%_80%)]" : "text-primary")}>{kicker}</p>
    <h2 className="text-[2rem] font-extrabold leading-[1.12] tracking-tight sm:text-4xl md:text-5xl">{title}</h2>
    {text && <p className={cn("mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg md:text-xl", light ? "text-white/80" : "text-muted-foreground")}>{text}</p>}
  </div>
);

// ---------------------------------------------------------------------------------------------
// Hero: a phone showing an SOS in progress, drawn in code (so it's sharp, themed and translated).

const PhoneMock = () => {
  const { t } = useI18n();
  return (
    <div role="img" aria-label={t("home.mock.label")} className="relative w-[17rem] sm:w-[19rem]">
      <div aria-hidden className="rounded-[2.75rem] border-[7px] border-neutral-900 bg-neutral-900 shadow-[0_40px_80px_-20px_hsl(264_66%_30%/0.45)] dark:border-neutral-700">
        <div className="overflow-hidden rounded-[2.25rem] bg-background">
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold text-foreground">
            <span>9:41</span>
            <span className="h-5 w-16 rounded-full bg-neutral-900" />
            <BatteryMedium className="h-4 w-4" />
          </div>
          {/* alert header */}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground">
              <span className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" /> {t("home.mock.sent")}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("live.justNow")}</span>
          </div>
          {/* map */}
          <div className="relative mx-4 h-40 overflow-hidden rounded-2xl bg-[hsl(var(--primary)/0.06)] ring-1 ring-border">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px),linear-gradient(hsl(var(--border))_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute -left-4 top-16 h-3.5 w-[130%] -rotate-12 rounded-full bg-card ring-1 ring-border" />
            <div className="absolute left-28 top-0 h-[130%] w-3.5 rotate-6 rounded-full bg-card ring-1 ring-border" />
            <span className="absolute left-[44%] top-[36%] flex h-5 w-5 items-center justify-center">
              <span className="absolute h-14 w-14 rounded-full bg-destructive/20 motion-safe:animate-ping" />
              <span className="h-4 w-4 rounded-full border-2 border-white bg-destructive shadow" />
            </span>
            <span className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2.5 rounded-xl bg-card/95 p-2 shadow-card">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[11px] font-bold">{t("home.cardTitle")}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{t("home.cardText")}</span>
              </span>
            </span>
          </div>
          {/* deliveries */}
          <ul className="space-y-2 px-5 pt-4 text-xs">
            {["Mom", "Priya"].map((name) => (
              <li key={name} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span className="font-semibold">{name}</span>
                <span className="truncate text-muted-foreground">· {t("sos.delivery.smsDelivered")}</span>
              </li>
            ))}
          </ul>
          <div className="mx-4 mt-3.5 flex items-center gap-2 rounded-xl bg-success/15 px-3.5 py-2.5 text-xs font-bold text-foreground ring-1 ring-success/30 motion-safe:animate-fade-in">
            <Navigation className="h-4 w-4 shrink-0 text-success" /> {t("live.onTheWay", { name: "Mom" })}
          </div>
          <div className="space-y-1.5 px-5 pt-3 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse" />
              <span className="truncate">{t("rec.recording", { count: 3 })}</span>
            </p>
            <p className="flex items-center gap-2">
              <BatteryMedium className="h-3.5 w-3.5 shrink-0" /> {t("track.battery", { percent: 62 })}
            </p>
          </div>
          <div className="p-4">
            <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
              <Shield className="h-4 w-4" /> {t("live.safe")}
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
    <section className="relative px-4 pb-24 pt-16 md:pb-32 lg:flex lg:min-h-[54vw] lg:items-end lg:pb-16 lg:pt-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(50%_45%_at_20%_15%,hsl(var(--primary)/0.16),transparent),radial-gradient(40%_40%_at_90%_35%,hsl(var(--brand)/0.13),transparent)]" />
      {/* Computers: the whole photo fills the hero. It fades into the page at the bottom and on
          the left, behind the headline, so the text stays readable and the faces stay clear. */}
      <div className="absolute inset-0 hidden overflow-hidden lg:block">
        <img
          src={heroImage}
          alt={t("home.heroImageAlt")}
          className="absolute inset-x-0 top-0 h-auto w-full [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_95%)] [mask-image:linear-gradient(to_bottom,black_50%,transparent_95%)]"
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--background)/0.9)_0%,hsl(var(--background)/0.6)_32%,transparent_58%)]" />
      </div>
      {/* Phones and tablets: the whole photo, edge to edge under the navigation bar, fading into
          the page behind the headline. */}
      <div className="relative -mx-4 -mb-12 lg:hidden">
        <img
          src={heroImage}
          alt={t("home.heroImageAlt")}
          className="block aspect-video w-full object-cover [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        />
      </div>
      <div className="container relative mx-auto grid w-full max-w-7xl items-end gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <div className="space-y-8 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-success" /> {t("home.badge")}
          </span>
          <h1 className="text-[2.35rem] font-extrabold leading-[1.06] tracking-tight sm:text-6xl xl:text-[4rem]">
            <span className={gradientText}>{t("home.heroTitle1")}</span>
            <br />
            {t("home.heroTitle2")}
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl lg:mx-0">{t("home.heroText")}</p>
          <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row lg:justify-start">
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
          <ul className="flex flex-col items-center gap-3 pt-2 text-sm font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:justify-start">
            {(["home.trust1", "home.trust2", "home.trust3"] as MessageKey[]).map((k) => (
              <li key={k} className="flex items-center gap-2">
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

        {/* The phone in front of the photo; on computers it sits low and overlaps the next
            section, so it covers as little of the photo as possible. */}
        <div className="relative z-10 mx-auto flex w-full max-w-xl justify-center lg:translate-y-32 lg:justify-end">
          <PhoneMock />
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
    if (!step && e.key !== "Home" && e.key !== "End") return;
    const to = e.key === "Home" ? 0 : e.key === "End" ? SITUATIONS.length - 1 : (active + step + SITUATIONS.length) % SITUATIONS.length;
    e.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  };

  return (
    <section className="px-4 py-20 md:py-32">
      <div className="container mx-auto max-w-6xl">
        <SectionHeader kicker={t("home.sitKicker")} title={t("home.sitTitle")} text={t("home.sitText")} />

        <div role="tablist" aria-label={t("home.sitKicker")} onKeyDown={onKeyDown} className="reveal mb-10 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
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
                  "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all sm:rounded-full sm:px-5",
                  selected ? "border-transparent bg-primary text-primary-foreground shadow-raised" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <TabIcon className="h-4 w-4 shrink-0" /> {t(sk(item.id, "tab"))}
              </button>
            );
          })}
        </div>

        <div
          id="sit-panel"
          role="tabpanel"
          aria-labelledby={`sit-tab-${s.id}`}
          key={s.id}
          className="grid overflow-hidden rounded-[2.5rem] bg-card shadow-card ring-1 ring-border motion-safe:animate-fade-in md:grid-cols-[1fr_1.3fr]"
        >
          <div className="relative flex min-h-[15rem] flex-col justify-between gap-8 overflow-hidden bg-gradient-to-br from-primary to-brand p-7 text-white sm:p-10 md:min-h-[18rem] md:p-14">
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10" />
            <div aria-hidden className="pointer-events-none absolute -right-2 top-12 h-28 w-28 rounded-full bg-white/10" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Icon className="h-8 w-8" />
            </span>
            <div className="relative">
              <h3 className="mb-3 text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl">{t(sk(s.id, "title"))}</h3>
              <p className="text-base leading-relaxed text-white/90 md:text-lg">{t(sk(s.id, "text"))}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-8 p-7 sm:p-10 md:gap-10 md:p-14">
            <ul className="space-y-5 md:space-y-6">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="text-base leading-relaxed md:text-lg">{t(sk(s.id, `p${n}`))}</span>
                </li>
              ))}
            </ul>
            <Link to={s.link} className="group inline-flex items-center gap-1.5 self-start text-lg font-semibold text-primary">
              {t(sk(s.id, "cta"))} <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
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
  <span aria-hidden className="flex h-12 items-center gap-1.5">
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
  <span aria-hidden className="grid w-32 grid-cols-4 gap-1 rounded-2xl bg-neutral-900 p-2.5 font-mono text-[10px] font-bold text-white shadow-lg">
    <span className="col-span-4 mb-1 truncate text-right text-base">1357</span>
    {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map((k) => (
      <span key={k} className={cn("flex h-5 items-center justify-center rounded", k === "=" ? "bg-destructive" : "bg-white/10")}>
        {k}
      </span>
    ))}
  </span>
);

const RecordingPieces = () => (
  <span aria-hidden className="flex flex-wrap justify-end gap-2">
    {["0:10", "0:20", "0:30"].map((t) => (
      <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 font-mono text-xs font-semibold text-destructive">
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
    <section className="bg-muted/50 px-4 py-20 md:py-32">
      <div className="container mx-auto max-w-6xl">
        <SectionHeader kicker={t("home.discreetKicker")} title={t("home.discreetTitle")} text={t("home.discreetText")} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DISCREET.map(({ id, icon: Icon, art: Art, wide }, i) => (
            <div
              key={id}
              className={cn(
                "reveal flex flex-col justify-between gap-8 rounded-[2rem] p-7 md:gap-10 md:p-10",
                wide ? "bg-gradient-to-br from-primary/10 via-card to-brand/10 ring-1 ring-primary/15 sm:col-span-2 lg:col-span-2" : "bg-card shadow-card"
              )}
              style={delay((i % 3) * 70)}
            >
              <div className="flex items-start justify-between gap-6">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                  <Icon className="h-6 w-6" />
                </span>
                {Art && <Art />}
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold md:text-2xl">{t(`home.discreet.${id}.title` as MessageKey)}</h3>
                <p className="text-base leading-relaxed text-muted-foreground">{t(`home.discreet.${id}.text` as MessageKey)}</p>
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
    <section className="px-4 py-20 md:py-32">
      <div className="container mx-auto max-w-6xl">
        <SectionHeader kicker={t("home.afterKicker")} title={t("home.afterTitle")} text={t("home.afterText")} />
        <ol className="relative grid gap-14 sm:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-0.5 bg-gradient-to-r from-primary/30 via-brand/40 to-primary/30 lg:block" />
          {AFTER.map(({ id, icon: Icon }, i) => (
            <li key={id} className="reveal relative px-2 text-center" style={delay(i * 90)}>
              <span className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-raised ring-1 ring-border">
                <Icon className="h-7 w-7" />
                <span className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <h3 className="mb-2 text-xl font-bold">{t(`home.after.${id}.title` as MessageKey)}</h3>
              <p className="mx-auto max-w-[16rem] text-base leading-relaxed text-muted-foreground">{t(`home.after.${id}.text` as MessageKey)}</p>
            </li>
          ))}
        </ol>
        <div className="reveal mt-16 flex flex-col justify-center gap-4 sm:flex-row">
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

const LANGUAGE_CARDS: Array<{ code: Lang; sos: string }> = [
  { code: "en", sos: "Emergency SOS" },
  { code: "hi", sos: "आपातकालीन SOS" },
  { code: "ta", sos: "அவசர SOS" },
  { code: "bn", sos: "জরুরি SOS" },
  { code: "mr", sos: "आपत्कालीन SOS" },
];

const Languages = () => {
  const { t, lang, setLang } = useI18n();
  return (
    <section className="px-4 pb-20 md:pb-32">
      <div className="container mx-auto max-w-6xl">
        <SectionHeader kicker={t("home.langKicker")} title={t("home.langTitle")} text={t("home.langText")} />
        <div className="reveal flex flex-wrap justify-center gap-3">
          {LANGUAGE_CARDS.map(({ code, sos }) => {
            const current = code === lang;
            return (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={current}
                onClick={() => setLang(code)}
                className={cn(
                  "flex items-center gap-3 rounded-full border bg-card py-1.5 pl-1.5 pr-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40",
                  current && "border-primary ring-2 ring-primary/30"
                )}
              >
                <span className="rounded-full bg-destructive px-3.5 py-2 text-xs font-extrabold text-destructive-foreground sm:text-sm">{sos}</span>
                <span className="font-bold">{LANGS[code].label}</span>
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
        <Situations />
        <Discreet />
        <AfterIncident />
        <Languages />

        {/* Privacy promise */}
        <section className="px-4 pb-20 md:pb-32">
          <div className="reveal container relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[hsl(262_40%_12%)] px-6 py-14 text-white sm:px-10 md:px-16 md:py-24">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[hsl(338_80%_57%/0.25)] blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[hsl(264_66%_50%/0.35)] blur-3xl" />
            <div className="relative grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-16">
              <div>
                <Shield className="mb-6 h-12 w-12 text-[hsl(266_85%_78%)]" />
                <h2 className="mb-4 text-[2rem] font-extrabold leading-tight sm:text-4xl md:text-5xl">{t("home.privacyTitle")}</h2>
                <p className="text-lg leading-relaxed text-white/85">{t("home.privacyText")}</p>
                <Link to="/privacy" className="mt-6 inline-block font-semibold text-[hsl(266_85%_82%)] underline underline-offset-4">
                  {t("footer.privacy")}
                </Link>
              </div>
              <ul className="space-y-4">
                {PROMISES.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-5 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                    <Icon className="mt-1 h-6 w-6 shrink-0 text-[hsl(266_85%_78%)]" />
                    <div>
                      <h3 className="mb-1 text-lg font-bold">{t(title)}</h3>
                      <p className="leading-relaxed text-white/80">{t(text)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How it works, and the call to action */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-brand/10 px-4 py-20 md:py-32">
          <div className="container mx-auto max-w-6xl">
            <SectionHeader kicker={t("home.howKicker")} title={t("home.howTitle")} />
            <ol className="grid gap-12 md:grid-cols-3 md:gap-10">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="reveal text-center" style={delay(i * 90)}>
                  <span className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                    <Icon className="h-8 w-8" />
                    <span className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-card text-sm font-extrabold text-primary shadow-card ring-1 ring-border">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mb-2 text-xl font-bold md:text-2xl">{t(title)}</h3>
                  <p className="mx-auto max-w-xs text-base leading-relaxed text-muted-foreground">{t(text)}</p>
                </li>
              ))}
            </ol>

            <div className="reveal mx-auto mt-20 max-w-3xl space-y-6 border-t border-primary/15 pt-16 text-center md:mt-24">
              <p className="text-3xl font-extrabold tracking-tight md:text-4xl">
                {tr("home.ctaTitle", { highlight: <span className={gradientText}>{t("home.ctaHighlight")}</span> })}
              </p>
              <p className="text-lg leading-relaxed text-muted-foreground">{t("home.ctaText")}</p>
              <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row">
                <Link to="/signup">
                  <Button variant="hero" size="xl" className="w-full gap-2 sm:w-auto">
                    <Users className="h-5 w-5" />
                    {t("home.ctaSignup")}
                  </Button>
                </Link>
                <Link to="/about">
                  <Button variant="glass" size="xl" className="w-full sm:w-auto">
                    {t("home.ctaAbout")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
