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

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

const Support = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm here with you. This is a safe, judgment‑free space for women to share what they're going through. Your feelings matter, and you deserve care and safety. How would you like to begin?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<"ai" | "fallback" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // auto-scroll to bottom on new message
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
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
        },
      });
      setMode(data.mode);
      const assistant = data.message;
      const assistantMessage: Message = { role: "assistant", content: assistant?.content || "I'm here for you.", ts: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble responding right now, but I'm here with you.", ts: new Date().toISOString() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Support Chat
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A compassionate AI companion to talk things through. It's not a therapist or an emergency service.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <Card className="lg:col-span-2 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Support Chat
                </CardTitle>
                <CardDescription>Share your thoughts in a safe, judgment-free space</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Messages */}
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <Avatar className="mr-3">
                            <AvatarFallback>AI</AvatarFallback>
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
                          <span className={`mt-1 text-[10px] text-muted-foreground ${message.role === "user" ? "text-right" : "text-left"}`}>
                            {message.ts ? new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </span>
                        </div>
                        {message.role === "user" && (
                          <Avatar className="ml-3">
                            <AvatarFallback>YOU</AvatarFallback>
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
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isTyping && handleSend()}
                    className="flex-1"
                    disabled={isTyping}
                  />
                  <Button onClick={handleSend} variant="hero" size="icon" disabled={isTyping}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {mode === "fallback" && (
                  <p className="text-xs text-center rounded-md bg-muted px-3 py-2">
                    The AI model isn't available right now, so you're getting simple scripted replies.
                  </p>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Messages are sent to an AI model to generate replies and aren't saved by HerSpace. This is support, not
                  medical or legal advice.
                </p>
              </CardContent>
            </Card>

            {/* Support Resources */}
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <Heart className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Emotional Wellness</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Talk through anxiety, stress, or something that happened. It can suggest grounding exercises and next steps.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <Brain className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Mental Health Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="mb-4">
                    Professional help is available if you need more support
                  </CardDescription>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a className="text-primary underline" href="tel:181">181</a> Women Helpline (India)
                    </li>
                    <li>
                      <a className="text-primary underline" href="tel:14416">14416</a> Tele-MANAS mental health (India)
                    </li>
                    <li>
                      <a className="text-primary underline" href="tel:988">988</a> Suicide &amp; Crisis Lifeline (US)
                    </li>
                    <li>
                      <a className="text-primary underline" href="https://findahelpline.com" target="_blank" rel="noreferrer">
                        findahelpline.com
                      </a>{" "}
                      for other countries
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">Crisis Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    If you're in immediate danger, call {EMERGENCY_NUMBER} or alert your trusted contacts.
                  </p>
                  <Link to="/sos">
                    <Button variant="emergency" className="w-full">Emergency SOS</Button>
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
