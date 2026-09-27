import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Heart, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { api, EMERGENCY_NUMBER } from "@/lib/api";
import { useI18n } from "@/i18n";
import PageHeader from "@/components/PageHeader";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

const Support = () => {
  const { t, lang } = useI18n();
  // The greeting is rendered from the current language rather than stored, so it follows a
  // language switch; it's never sent to the API.
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<"ai" | "fallback" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep the newest message in view by scrolling the chat panel only. scrollIntoView would
    // also scroll the page, which jumps phones past the header on first load.
    if (messages.length === 0 && !isTyping) return;
    const viewport = scrollRef.current?.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input, ts: new Date().toISOString() };
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

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <Card className="lg:col-span-2">
              <CardContent className="space-y-4 pt-6">
                {/* Messages */}
                <ScrollArea className="h-[52vh] min-h-[320px] pr-4 lg:h-[500px]">
                  <div className="space-y-4">
                    <div className="flex justify-start">
                      <Avatar className="mr-3">
                        <AvatarFallback>{t("support.ai")}</AvatarFallback>
                      </Avatar>
                      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm bg-secondary text-secondary-foreground">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{t("support.greeting")}</p>
                      </div>
                    </div>
                    {messages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" && (
                          <Avatar className="mr-3">
                            <AvatarFallback>{t("support.ai")}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col max-w-[80%]">
                          <div
                            className={`rounded-2xl px-4 py-3 shadow-sm ${
                              message.role === "user"
                                ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-sm"
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
                        {message.role === "user" && (
                          <Avatar className="ml-3">
                            <AvatarFallback className="text-[10px]">{t("support.you")}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-secondary text-secondary-foreground rounded-lg p-4">
                          <div className="flex gap-1">
                            <span className="animate-pulse">●</span>
                            <span className="animate-pulse delay-100">●</span>
                            <span className="animate-pulse delay-200">●</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder={t("support.placeholder")}
                    aria-label={t("support.messageLabel")}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isTyping && handleSend()}
                    className="flex-1"
                    disabled={isTyping}
                  />
                  <Button onClick={handleSend} variant="hero" size="icon" disabled={isTyping} aria-label={t("support.send")}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

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
