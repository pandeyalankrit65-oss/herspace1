import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Heart, Brain, Mic, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { api, EMERGENCY_NUMBER } from "@/lib/api";
import { speechLocale, useI18n } from "@/i18n";
import { canSpeak, speak, stopSpeaking } from "@/lib/speak";
import { canListen, listenOnce, ListenFailed, type Listening } from "@/lib/listen";
import PageHeader from "@/components/PageHeader";
import { useOnline } from "@/lib/offline";
import Logo from "@/components/Logo";
import type { MessageKey } from "@/i18n/en";
import DistressBanner from "@/components/DistressBanner";
import { detectDistress, type Distress } from "@/lib/distress";

// Conversation starters shown before the first message.
const STARTERS: MessageKey[] = ["support.starter1", "support.starter2", "support.starter3", "support.starter4"];

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

const Support = () => {
  const { t, lang } = useI18n();
  // Voice: speak a message instead of typing, and have replies read aloud.
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const session = useRef<Listening | null>(null);
  const [speakReplies, setSpeakReplies] = useState(() => {
    try {
      return localStorage.getItem("herspace_chat_speak") === "1";
    } catch {
      return false;
    }
  });
  const readReply = (text: string) => {
    if (canSpeak) speak(text, speechLocale(lang)).catch(() => {});
  };
  const toggleSpeak = () => {
    const next = !speakReplies;
    setSpeakReplies(next);
    if (!next && canSpeak) stopSpeaking();
    try {
      localStorage.setItem("herspace_chat_speak", next ? "1" : "0");
    } catch {
      // ignore
    }
  };
  useEffect(
    () => () => {
      session.current?.stop();
      if (canSpeak) stopSpeaking();
    },
    []
  );
  // The greeting is rendered from the current language rather than stored, so it follows a
  // language switch; it's never sent to the API.
  const [messages, setMessages] = useState<Message[]>([]);
  // Danger or self-harm spotted in what she wrote: offer SOS or a helpline straight away.
  const [distress, setDistress] = useState<Distress | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<"ai" | "fallback" | null>(null);
  const online = useOnline();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep the newest message in view by scrolling the chat panel only. scrollIntoView would
    // also scroll the page, which jumps phones past the header on first load.
    if (messages.length === 0 && !isTyping) return;
    const viewport = scrollRef.current?.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    const userMessage: Message = { role: "user", content: text, ts: new Date().toISOString() };
    const spotted = detectDistress(text);
    // Self-harm outranks danger: once shown, a later "danger" message doesn't replace it.
    if (spotted) setDistress((prev) => (prev === "self_harm" ? prev : spotted));
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    try {
      const data = await api<{ message: { role: "assistant"; content: string }; mode: "ai" | "fallback" }>("/api/chat", {
        body: {
          messages: [...messages, userMessage].slice(-20).map(({ role, content }) => ({ role, content })),
          lang,
        },
      });
      setMode(data.mode);
      const assistant = data.message;
      const assistantMessage: Message = {
        role: "assistant",
        content: assistant?.content || t("support.emptyReply"),
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (speakReplies) readReply(assistantMessage.content);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("support.errorReply"), ts: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <PageHeader icon={MessageCircle} title={t("support.title")} subtitle={t("support.subtitle")} />
          {!online && (
            <div role="alert" className="mb-6 space-y-2 rounded-2xl border border-warning/60 bg-warning/10 p-4 text-sm">
              <p className="font-semibold">{t("offline.chat")}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <a href="tel:181" className="font-semibold underline underline-offset-2">181 · {t("support.helplineWomen")}</a>
                <a href="tel:14416" className="font-semibold underline underline-offset-2">14416 · {t("support.helplineTeleManas")}</a>
                <a href={`tel:${EMERGENCY_NUMBER}`} className="font-semibold underline underline-offset-2">{t("common.call", { number: EMERGENCY_NUMBER })}</a>
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <Card className="lg:col-span-2">
              <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-6">
                {distress && <DistressBanner kind={distress} onDismiss={() => setDistress(null)} />}
                {/* Messages */}
                <ScrollArea className="h-[calc(100dvh-29rem)] min-h-[300px] pr-3 lg:h-[500px]">
                  <div className="space-y-4">
                    <div className="flex justify-start">
                      <Logo className="mr-3 h-9 w-9" />
                      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm bg-secondary text-secondary-foreground">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{t("support.greeting")}</p>
                      </div>
                    </div>
                    {messages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" && <Logo className="mr-3 h-9 w-9" />}
                        <div className="flex max-w-[85%] flex-col">
                          <div
                            className={`rounded-2xl px-4 py-3 shadow-sm ${
                              message.role === "user"
                                ? "bg-gradient-to-br from-primary to-brand text-primary-foreground rounded-br-sm"
                                : "bg-secondary text-secondary-foreground rounded-bl-sm"
                            }`}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <span
                            className={`mt-1 text-[10px] text-muted-foreground ${message.role === "user" ? "text-right" : "text-left"}`}
                          >
                            {message.ts
                              ? new Date(message.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <div className="flex flex-wrap gap-2 pl-12">
                        {STARTERS.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleSend(t(key))}
                            className="rounded-full border bg-card px-3 py-1.5 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
                          >
                            {t(key)}
                          </button>
                        ))}
                      </div>
                    )}
                    {isTyping && (
                      <div className="flex items-center justify-start" role="status" aria-label={t("support.typing")}>
                        <Logo className="mr-3 h-9 w-9" />
                        <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-secondary px-4 py-4">
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="h-2 w-2 rounded-full bg-muted-foreground/70 motion-safe:animate-bounce"
                              style={{ animationDelay: `${delay}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="flex gap-2 rounded-full border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
                  <Input
                    placeholder={t("support.placeholder")}
                    aria-label={t("support.messageLabel")}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isTyping && handleSend()}
                    className="h-10 flex-1 rounded-full border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isTyping}
                  />
                  {canListen() && (
                    <Button
                      type="button"
                      variant={listening ? "hero" : "ghost"}
                      size="icon"
                      className={`h-10 w-10 shrink-0 rounded-full ${listening ? "motion-safe:animate-pulse" : ""}`}
                      disabled={isTyping}
                      aria-pressed={listening}
                      aria-label={listening ? t("chatVoice.stop") : t("chatVoice.speak")}
                      onClick={() => {
                        if (listening) {
                          session.current?.stop();
                          setListening(false);
                          return;
                        }
                        setVoiceError(null);
                        setListening(true);
                        const s = listenOnce(speechLocale(lang), setInput);
                        session.current = s;
                        s.result
                          .then((heard) => {
                            if (session.current === s && heard[0]) handleSend(heard[0]);
                          })
                          .catch((err) => {
                            if (session.current !== s) return;
                            const kind = err instanceof ListenFailed ? err.kind : "other";
                            setVoiceError(kind === "blocked" ? t("sos.micBlockedDesc") : kind === "noMic" ? t("sos.voiceNoMic") : t("chatVoice.notHeard"));
                          })
                          .finally(() => session.current === s && setListening(false));
                      }}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}
                  <Button onClick={() => handleSend()} variant="hero" size="icon" className="h-10 w-10 shrink-0 rounded-full" disabled={isTyping || !input.trim()} aria-label={t("support.send")}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {voiceError && (
                  <p role="alert" className="text-center text-sm text-destructive">
                    {voiceError}
                  </p>
                )}
                {canSpeak && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={toggleSpeak}
                      aria-pressed={speakReplies}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {speakReplies ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                      {t("chatVoice.readReplies")}
                    </button>
                  </div>
                )}
                {mode === "fallback" && (
                  <p className="text-xs text-center rounded-md bg-muted px-3 py-2">{t("support.fallbackNote")}</p>
                )}
                <p className="text-xs text-muted-foreground text-center">{t("support.privacyNote")}</p>
              </CardContent>
            </Card>

            {/* Support Resources */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Heart className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("support.wellnessTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{t("support.wellnessDesc")}</CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Brain className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("support.resourcesTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="mb-4">{t("support.resourcesDesc")}</CardDescription>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a className="text-primary underline" href="tel:181">
                        181
                      </a>{" "}
                      {t("support.helplineWomen")}
                    </li>
                    <li>
                      <a className="text-primary underline" href="tel:14416">
                        14416
                      </a>{" "}
                      {t("support.helplineTeleManas")}
                    </li>
                    <li>
                      <a className="text-primary underline" href="tel:988">
                        988
                      </a>{" "}
                      {t("support.helpline988")}
                    </li>
                    <li>
                      <a className="text-primary underline" href="https://findahelpline.com" target="_blank" rel="noreferrer">
                        findahelpline.com
                      </a>{" "}
                      {t("support.otherCountries")}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">{t("support.crisisTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{t("support.crisisDesc", { number: EMERGENCY_NUMBER })}</p>
                  <Link to="/sos">
                    <Button variant="emergency" className="w-full">
                      {t("common.emergencySos")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Support;
