import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Phone, MapPin, MessageSquare, Mic, MicOff, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api, EMERGENCY_NUMBER } from "@/lib/api";
import type { Contact } from "./Contacts";

type Coords = { lat: number; lng: number; accuracy?: number };
type Delivery = { name: string; phone: string; channel: "sms" | "call"; status: string; error?: string | null };
type SosResult = {
  id?: number;
  deliveries: Delivery[];
  smsConfigured: boolean;
  trackingDelivery?: boolean;
  message: string;
  serverError?: string;
};

// An SMS counts as reaching the contact once Twilio accepted it; "delivered" is confirmed by the carrier.
const smsReached = (d: Delivery) => d.status === "sent" || d.status === "delivered";

function describe(d: Delivery, tracking: boolean): string {
  if (d.channel === "call") {
    return (
      { sent: "calling...", answered: "call answered", unanswered: "call not answered", failed: "call failed" }[d.status] ??
      "call not placed"
    );
  }
  switch (d.status) {
    case "delivered":
      return "SMS delivered";
    case "sent":
      return tracking ? "SMS sent, waiting for delivery confirmation" : "SMS sent";
    case "failed":
      return `SMS failed${d.error ? `: ${d.error}` : ""}`;
    case "not_confirmed":
      return "not alerted: hasn't confirmed as your contact yet";
    default:
      return "not sent: SMS isn't set up";
  }
}

const POLL_INTERVAL_MS = 5000;
const POLL_DURATION_MS = 3 * 60 * 1000;

const COUNTDOWN_SECONDS = 3;

function getLocation(): Promise<Coords | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

const fallbackMessage = (name: string | undefined, coords?: Coords) =>
  `HerSpace SOS: ${name ?? "I"} need${name ? "s" : ""} help. ` +
  (coords ? `Location: https://maps.google.com/?q=${coords.lat},${coords.lng}` : "Location unavailable.") +
  " Please call now.";

// "?&body=" is understood by both Android and iOS messaging apps.
const smsLink = (phone: string, body: string) => `sms:${phone}?&body=${encodeURIComponent(body)}`;

// Minimal typing for the Web Speech API, which isn't in TypeScript's DOM lib.
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
const SpeechRecognitionImpl: (new () => Recognition) | undefined =
  typeof window !== "undefined"
    ? (window as unknown as Record<string, new () => Recognition>).SpeechRecognition ||
      (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition
    : undefined;

const SOS = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SosResult | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const wantListeningRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setContacts([]);
      return;
    }
    api<{ contacts: Contact[] }>("/api/contacts")
      .then((res) => setContacts(res.contacts))
      .catch(() => {});
  }, [user]);

  const sendSOS = useCallback(async () => {
    setSending(true);
    setResult(null);
    const coords = await getLocation();
    try {
      const res = await api<SosResult>("/api/sos", { body: { coords } });
      setResult(res);
    } catch (err) {
      setResult({
        deliveries: [],
        smsConfigured: false,
        message: fallbackMessage(user?.name, coords),
        serverError: (err as Error).message,
      });
    } finally {
      setSending(false);
    }
  }, [user]);

  // Upgrade "sent" to "delivered"/"answered" as Twilio reports back.
  const resultId = result?.id;
  const tracking = Boolean(result?.trackingDelivery && user);
  useEffect(() => {
    if (!resultId || !tracking) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > POLL_DURATION_MS) return clearInterval(timer);
      try {
        const res = await api<{ deliveries: Delivery[] }>(`/api/sos/${resultId}`);
        setResult((prev) => (prev && prev.id === resultId ? { ...prev, deliveries: res.deliveries } : prev));
      } catch {
        // Keep showing the last known status.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [resultId, tracking]);

  // Countdown gives a moment to cancel an accidental press.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      sendSOS();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, sendSOS]);

  const startCountdown = useCallback(() => {
    setCountdown((c) => (c === null ? COUNTDOWN_SECONDS : c));
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = () => {
    if (!SpeechRecognitionImpl) {
      toast({
        title: "Voice trigger not supported",
        description: "This browser doesn't support speech recognition. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (/\bhelp\s*me\b|\bbachao\b/i.test(e.results[i][0].transcript)) {
          startCountdown();
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast({ title: "Microphone blocked", description: "Allow microphone access to use the voice trigger.", variant: "destructive" });
        stopListening();
      }
    };
    // Browsers end recognition after silence; restart while the user wants it on.
    rec.onend = () => {
      if (wantListeningRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      }
    };
    recognitionRef.current = rec;
    wantListeningRef.current = true;
    rec.start();
    setListening(true);
  };

  useEffect(() => () => stopListening(), [stopListening]);

  const confirmedCount = contacts.filter((c) => c.status === "confirmed").length;
  const smsDeliveries = result?.deliveries.filter((d) => d.channel === "sms") ?? [];
  const sentCount = smsDeliveries.filter(smsReached).length;
  const deliveredAll = smsDeliveries.length > 0 && sentCount === smsDeliveries.length;
  const unconfirmedCount = smsDeliveries.filter((d) => d.status === "not_confirmed").length;
  // Contacts the user should text by hand: whoever the server didn't reach, or everyone
  // if the server couldn't be contacted at all.
  const fallbackContacts: Array<Pick<Contact, "name" | "phone">> = !result
    ? []
    : smsDeliveries.length > 0
      ? smsDeliveries.filter((d) => !smsReached(d))
      : contacts;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-destructive to-red-600 bg-clip-text text-transparent">Emergency SOS</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              In immediate danger? Call{" "}
              <a href={`tel:${EMERGENCY_NUMBER}`} className="font-semibold text-destructive underline">
                {EMERGENCY_NUMBER}
              </a>{" "}
              first. HerSpace alerts your trusted contacts; it does not contact police or emergency services.
            </p>
          </div>

          <Card className="mb-8 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-destructive/50">
            <CardContent className="p-6 sm:p-12 text-center space-y-8">
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {user
                    ? confirmedCount > 0
                      ? `Sends an SMS with your current location to your ${confirmedCount} confirmed emergency contact${confirmedCount === 1 ? "" : "s"}.`
                      : contacts.length > 0
                        ? "None of your contacts have confirmed yet, so no one will be alerted automatically. Ask them to open their invite link."
                        : "You haven't added any emergency contacts yet, so there's no one to alert."
                    : "You're not logged in, so there are no saved contacts to alert. You can still call for help below."}
                </p>

                {countdown !== null ? (
                  <div className="space-y-4">
                    <div className="mx-auto w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-destructive/15 border-4 border-destructive flex flex-col items-center justify-center">
                      <span className="text-7xl font-bold text-destructive" aria-live="assertive">{countdown}</span>
                      <span className="text-sm text-muted-foreground">Sending alert...</span>
                    </div>
                    <Button variant="outline" size="lg" onClick={() => setCountdown(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="emergency"
                    size="xl"
                    className={`w-56 h-56 sm:w-64 sm:h-64 rounded-full text-2xl font-bold ${sending ? "animate-pulse" : ""}`}
                    onClick={startCountdown}
                    disabled={sending}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle className="h-20 w-20" />
                      {sending ? "SENDING..." : "EMERGENCY SOS"}
                    </div>
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <a href={`tel:${EMERGENCY_NUMBER}`}>
                  <Button variant="emergency" size="lg" className="gap-2 w-full">
                    <Phone className="h-5 w-5" />
                    Call {EMERGENCY_NUMBER}
                  </Button>
                </a>
                <Button variant="glass" size="lg" onClick={listening ? stopListening : startListening} className="gap-2">
                  {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  {listening ? 'Listening for "help me"... (tap to stop)' : 'Voice trigger: "Help me"'}
                </Button>
              </div>
              {listening && (
                <p className="text-xs text-muted-foreground">
                  The voice trigger only works while this page stays open and the screen is on.
                </p>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card className={`mb-8 ${deliveredAll ? "border-green-500/50" : "border-destructive"}`} aria-live="polite">
              <CardHeader>
                <CardTitle>
                  {deliveredAll
                    ? `Alert sent to ${sentCount} contact${sentCount === 1 ? "" : "s"}`
                    : sentCount > 0
                      ? `Alert sent to ${sentCount} of ${smsDeliveries.length} contacts`
                      : "Your alert was NOT sent automatically"}
                </CardTitle>
                <CardDescription>
                  {result.serverError
                    ? `The server couldn't be reached (${result.serverError}). Use your phone to call or text for help now.`
                    : smsDeliveries.length === 0
                      ? "There are no saved contacts to alert. Call for help or text someone you trust directly."
                      : unconfirmedCount === smsDeliveries.length
                        ? "None of your contacts have confirmed yet, so no one was alerted automatically. Text them directly with the buttons below."
                        : !result.smsConfigured
                        ? "SMS sending isn't set up on this HerSpace server. Text your contacts directly with the buttons below."
                        : deliveredAll
                          ? "Keep your phone with you. Your contacts received a link to your location at the time of the alert."
                          : "Some messages failed. Text those contacts directly with the buttons below."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.deliveries.map((d) => (
                  <div key={`${d.channel}-${d.phone}`} className="flex items-center gap-2 text-sm">
                    {["sent", "delivered", "answered"].includes(d.status) ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground">{describe(d, Boolean(result.trackingDelivery))}</span>
                  </div>
                ))}
                {fallbackContacts.length > 0 && !deliveredAll && (
                  <div className="grid sm:grid-cols-2 gap-2 pt-2">
                    {fallbackContacts.map((c) => (
                      <div key={c.phone} className="flex gap-2">
                        <a href={smsLink(c.phone, result.message)} className="flex-1">
                          <Button variant="hero" className="w-full gap-2">
                            <MessageSquare className="h-4 w-4" /> Text {c.name}
                          </Button>
                        </a>
                        <a href={`tel:${c.phone}`}>
                          <Button variant="outline" size="icon" aria-label={`Call ${c.name}`}>
                            <Phone className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <MessageSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">SMS to your contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Each saved contact gets a text message. You'll see exactly who received it, and can text anyone it missed from your own phone.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Your location</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  If you allow location access, the message includes a map link to where you were when you pressed SOS. It is not tracked continuously.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Phone className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Emergency services</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  HerSpace doesn't alert the police. In immediate danger, call {EMERGENCY_NUMBER} directly.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <CardTitle>Emergency Contacts</CardTitle>
              <CardDescription>Add trusted people who should hear from you in an emergency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <p className="text-sm text-muted-foreground">
                  {confirmedCount} of {contacts.length} contact{contacts.length === 1 ? "" : "s"} confirmed
                </p>
              )}
              <Link to={user ? "/contacts" : "/login?next=/contacts"}>
                <Button variant="hero">{user ? "Manage Emergency Contacts" : "Log in to add contacts"}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SOS;
