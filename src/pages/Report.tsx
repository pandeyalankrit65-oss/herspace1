import { useState } from "react";
import { FileText, MapPin, Calendar, LocateFixed } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const Report = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const emptyForm = {
    incidentType: "",
    location: "",
    date: "",
    description: "",
    anonymous: false,
    includeCoords: false,
  };
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const getCoords = () =>
    new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 8000 }
      );
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.incidentType) {
      toast({ title: "Please choose an incident type", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const coords = formData.includeCoords ? await getCoords() : undefined;
      if (formData.includeCoords && !coords) {
        toast({ title: "Location unavailable", description: "Submitting without map coordinates." });
      }
      await api("/api/reports", {
        body: {
          incidentType: formData.incidentType,
          description: formData.description,
          location: formData.location,
          date: formData.date,
          anonymous: formData.anonymous || !user,
          coords,
        },
      });
      toast({
        title: "Report Submitted",
        description: "Thank you for your courage. Your report has been saved.",
      });
      setFormData(emptyForm);
    } catch (err) {
      toast({
        title: "Submission Failed",
        description: (err as Error).message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Report an Incident
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your voice matters. Documenting what happened helps you and helps others stay aware. Reports with a location
              appear on the Safe Map as approximate points, never with your description or identity.
            </p>
          </div>

          {/* Report Form */}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Incident Report Form
              </CardTitle>
              <CardDescription>
                Provide as much detail as you feel comfortable sharing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Incident Type */}
                <div className="space-y-2">
                  <Label htmlFor="incidentType">Incident Type *</Label>
                  <Select
                    value={formData.incidentType}
                    onValueChange={(value) => setFormData({ ...formData, incidentType: value })}
                  >
                    <SelectTrigger id="incidentType">
                      <SelectValue placeholder="Select incident type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="harassment">Harassment</SelectItem>
                      <SelectItem value="assault">Assault</SelectItem>
                      <SelectItem value="stalking">Stalking</SelectItem>
                      <SelectItem value="threat">Threat</SelectItem>
                      <SelectItem value="discrimination">Discrimination</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="Where did this occur? (Optional)"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date of Incident
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Incident Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Please describe what happened. Take your time and include any details you feel comfortable sharing..."
                    className="min-h-40 resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                {/* Map location */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="includeCoords"
                    className="h-4 w-4 mt-1 rounded border-border"
                    checked={formData.includeCoords}
                    onChange={(e) => setFormData({ ...formData, includeCoords: e.target.checked })}
                  />
                  <Label htmlFor="includeCoords" className="cursor-pointer leading-snug">
                    <span className="flex items-center gap-2">
                      <LocateFixed className="h-4 w-4" /> Add my current location to the Safe Map
                    </span>
                    <span className="block text-xs text-muted-foreground font-normal mt-1">
                      Only if you're where it happened. The map shows it rounded to about 1 km, with the incident type and date only.
                    </span>
                  </Label>
                </div>

                {/* Anonymous Option */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="anonymous"
                    className="h-4 w-4 mt-1 rounded border-border"
                    checked={formData.anonymous || !user}
                    disabled={!user}
                    onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                  />
                  <Label htmlFor="anonymous" className="cursor-pointer leading-snug">
                    Submit anonymously
                    <span className="block text-xs text-muted-foreground font-normal mt-1">
                      {user
                        ? "Anonymous reports aren't linked to your account, so you won't be able to see them later."
                        : "You're not logged in, so this report is anonymous."}
                    </span>
                  </Label>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button type="submit" variant="hero" size="lg" className="flex-1" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Reports are stored on the HerSpace server and are only visible to you (unless anonymous). They are not sent to the police.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Support Resources */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <CardTitle>Need Immediate Support?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you're in immediate danger, please contact emergency services or use the SOS feature.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/sos" className="flex-1">
                  <Button variant="emergency" className="w-full">Emergency SOS</Button>
                </Link>
                <Link to="/support" className="flex-1">
                  <Button variant="hero" className="w-full">Chat with AI Support</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Report;
