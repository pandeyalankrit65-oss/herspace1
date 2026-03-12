import { useState } from "react";
import { FileText, Upload, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";

const Report = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    incidentType: "",
    location: "",
    date: "",
    description: "",
    anonymous: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to submit report");
      toast({
        title: "Report Submitted",
        description: "Thank you for your courage. Your report has been securely submitted.",
      });
      setFormData({
        incidentType: "",
        location: "",
        date: "",
        description: "",
        anonymous: false,
      });
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
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
              Your voice matters. Help us build a safer community by reporting incidents. All reports are handled with
              confidentiality and care.
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
                Provide as much detail as you feel comfortable sharing. Your information is encrypted and secure.
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

                {/* File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="evidence" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Supporting Evidence (Optional)
                  </Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Click to upload images, documents, or screenshots
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB</p>
                    <Input id="evidence" type="file" className="hidden" multiple accept="image/*,.pdf" />
                  </div>
                </div>

                {/* Anonymous Option */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="anonymous"
                    className="h-4 w-4 rounded border-border"
                    checked={formData.anonymous}
                    onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                  />
                  <Label htmlFor="anonymous" className="cursor-pointer">
                    Submit anonymously
                  </Label>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button type="submit" variant="hero" size="lg" className="flex-1">
                    Submit Report
                  </Button>
                  <Button type="button" variant="glass" size="lg">
                    Save Draft
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  All reports are encrypted and handled with strict confidentiality. You are safe here.
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
                <Button variant="emergency" className="flex-1">Emergency SOS</Button>
                <Button variant="hero" className="flex-1">Chat with AI Support</Button>
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
