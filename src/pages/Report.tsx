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
import { useI18n } from "@/i18n";
import PageHeader from "@/components/PageHeader";

const Report = () => {
  const { toast } = useToast();
  const { t } = useI18n();
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
        { timeout: 8000 },
      );
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.incidentType) {
      toast({ title: t("report.chooseType"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const coords = formData.includeCoords ? await getCoords() : undefined;
      if (formData.includeCoords && !coords) {
        toast({ title: t("report.locUnavailableTitle"), description: t("report.locUnavailableDesc") });
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
        title: t("report.submittedTitle"),
        description: t("report.submittedDesc"),
      });
      setFormData(emptyForm);
    } catch (err) {
      toast({
        title: t("report.failedTitle"),
        description: (err as Error).message || t("report.failedDesc"),
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
          <PageHeader icon={FileText} title={t("report.title")} subtitle={t("report.intro")} />

          {/* Report Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t("report.formTitle")}
              </CardTitle>
              <CardDescription>{t("report.formDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Incident Type */}
                <div className="space-y-2">
                  <Label htmlFor="incidentType">{t("report.type")}</Label>
                  <Select
                    value={formData.incidentType}
                    onValueChange={(value) => setFormData({ ...formData, incidentType: value })}
                  >
                    <SelectTrigger id="incidentType">
                      <SelectValue placeholder={t("report.typePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="harassment">{t("report.types.harassment")}</SelectItem>
                      <SelectItem value="assault">{t("report.types.assault")}</SelectItem>
                      <SelectItem value="stalking">{t("report.types.stalking")}</SelectItem>
                      <SelectItem value="threat">{t("report.types.threat")}</SelectItem>
                      <SelectItem value="discrimination">{t("report.types.discrimination")}</SelectItem>
                      <SelectItem value="other">{t("report.types.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t("report.location")}
                  </Label>
                  <Input
                    id="location"
                    placeholder={t("report.locationPlaceholder")}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t("report.date")}
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    max={new Date().toLocaleDateString("en-CA")}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">{t("report.description")}</Label>
                  <Textarea
                    id="description"
                    placeholder={t("report.descriptionPlaceholder")}
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
                      <LocateFixed className="h-4 w-4" /> {t("report.addLocation")}
                    </span>
                    <span className="block text-xs text-muted-foreground font-normal mt-1">{t("report.addLocationHint")}</span>
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
                    {t("report.anonymous")}
                    <span className="block text-xs text-muted-foreground font-normal mt-1">
                      {user ? t("report.anonymousHintUser") : t("report.anonymousHintGuest")}
                    </span>
                  </Label>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button type="submit" variant="hero" size="lg" className="flex-1" disabled={submitting}>
                    {submitting ? t("report.submitting") : t("report.submit")}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">{t("report.storageNote")}</p>
              </form>
            </CardContent>
          </Card>

          {/* Support Resources */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>{t("report.needHelpTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("report.needHelpDesc")}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/sos" className="flex-1">
                  <Button variant="emergency" className="w-full">
                    {t("common.emergencySos")}
                  </Button>
                </Link>
                <Link to="/support" className="flex-1">
                  <Button variant="hero" className="w-full">
                    {t("report.chat")}
                  </Button>
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
