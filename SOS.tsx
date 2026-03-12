import { useEffect, useState } from "react";
import { AlertCircle, Phone, MapPin, Clock, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const SOS = () => {
  const [isActivated, setIsActivated] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string; relation?: string }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("herspace_contacts");
      if (raw) setContacts(JSON.parse(raw));
    } catch {}
  }, []);

  const handleSOSActivation = async () => {
    setIsActivated(true);
    try {
      let location: { lat?: number; lng?: number } = {};
      if (navigator.geolocation) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({})
          );
        });
      }

      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sos", location, contacts }),
      });
      if (!res.ok) throw new Error("Failed to send SOS");

      toast({
        title: "SOS Alert Activated",
        description:
          contacts.length > 0
            ? "Emergency contacts have been notified. Help is on the way."
            : "SOS sent. Add emergency contacts so trusted people can be notified.",
        variant: "destructive",
      });
      if (contacts.length === 0) {
        setTimeout(() => navigate("/contacts"), 800);
      }
    } catch (err: any) {
      toast({
        title: "SOS Failed",
        description: err?.message || "Could not send SOS. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsActivated(false);
      }, 5000);
    }
  };

  const handleVoiceCommand = () => {
    toast({
      title: "Voice Command Activated",
      description: "Say 'help me' to trigger emergency alert.",
    });
    // In production, integrate Web Speech API here
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-destructive to-red-600 bg-clip-text text-transparent">
                Emergency SOS
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Press the button or use voice command in case of emergency
            </p>
          </div>

          {/* Main SOS Button */}
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-destructive/50">
              <CardContent className="p-12 text-center space-y-8">
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Your location and emergency details will be sent to your trusted contacts and local authorities
                  </p>
                  <Button
                    variant="emergency"
                    size="xl"
                    className={`w-64 h-64 rounded-full text-2xl font-bold ${
                      isActivated ? "animate-pulse" : ""
                    }`}
                    onClick={handleSOSActivation}
                    disabled={isActivated}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle className="h-20 w-20" />
                      {isActivated ? "ALERT SENT" : "EMERGENCY SOS"}
                    </div>
                  </Button>
                  {isActivated && (
                    <p className="text-sm text-muted-foreground animate-pulse">
                      Emergency services have been notified...
                    </p>
                  )}
                </div>

                <div className="flex justify-center">
                  <Button variant="glass" size="lg" onClick={handleVoiceCommand} className="gap-2">
                    <Mic className="h-5 w-5" />
                    Voice Command: "Help Me"
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Emergency Info Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Phone className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Instant Alert</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Emergency contacts receive your location and status immediately via SMS and push notifications
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Live Location</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Your real-time GPS coordinates are shared with emergency services and trusted contacts
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Clock className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">24/7 Response</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Round-the-clock monitoring ensures immediate response regardless of time or location
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Emergency Contacts Info */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <CardTitle>Emergency Contacts</CardTitle>
              <CardDescription>
                Add trusted contacts who will be notified during emergencies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure your emergency contacts in Settings to ensure they receive instant alerts when you activate SOS.
              </p>
              <p className="text-sm text-muted-foreground">Current contacts: {contacts.length}</p>
              <Button variant="hero" onClick={() => navigate("/contacts")}>Manage Emergency Contacts</Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SOS;
