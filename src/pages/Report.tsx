import { useEffect, useRef, useState } from "react";
import { FileText, MapPin, Calendar, LocateFixed, ImagePlus, X } from "lucide-react";
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
import { api, ApiError } from "@/lib/api";
import { queueReport } from "@/lib/outbox";
import { useI18n } from "@/i18n";
import PageHeader from "@/components/PageHeader";
import { MAX_PHOTOS, preparePhoto, uploadPhoto } from "@/lib/photos";

const Report = () => {
  const { toast } = useToast();
  const { t, tn } = useI18n();
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
  const [photos, setPhotos] = useState<Array<{ blob: Blob; url: string }>>([]);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoUrls = useRef<string[]>([]);
  photoUrls.current = photos.map((p) => p.url);
  useEffect(() => () => photoUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addPhotos = async (files: FileList | null) => {
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files ?? []).slice(0, room);
    const added: Array<{ blob: Blob; url: string }> = [];
    for (const file of picked) {
      try {
        const blob = await preparePhoto(file);
        added.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        toast({ title: t("report.photoFailed"), variant: "destructive" });
      }
    }
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    if (photoInput.current) photoInput.current.value = "";
  };

  const removePhoto = (index: number) =>
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });

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
      const body = {
        incidentType: formData.incidentType,
        description: formData.description,
        location: formData.location,
        date: formData.date,
        anonymous: formData.anonymous || !user,
        coords,
      };
      let created: { id: number; uploadToken: string; held?: boolean };
      try {
        created = await api<{ id: number; uploadToken: string; held?: boolean }>("/api/reports", { body });
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 0) throw err;
        // No connection: keep it on this phone and send it when back online.
        await queueReport({ userId: body.anonymous ? null : (user?.id ?? null), body, photos: photos.map((p) => p.blob), createdAt: new Date().toISOString() });
        toast({ title: t("offline.reportQueuedTitle"), description: t("offline.reportQueuedDesc") });
        setFormData(emptyForm);
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setPhotos([]);
        return;
      }
      let failedUploads = 0;
      for (const photo of photos) {
        await uploadPhoto(created.id, created.uploadToken, photo.blob).catch(() => failedUploads++);
      }
      toast({
        title: t("report.submittedTitle"),
        description: failedUploads ? tn("report.photosNotUploaded", failedUploads) : created.held ? t("report.heldDesc") : t("report.submittedDesc"),
        variant: failedUploads ? "destructive" : undefined,
      });
      setFormData(emptyForm);
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
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

                {/* Photos */}
                <div className="space-y-2">
                  <Label htmlFor="report-photos">{t("report.photos")}</Label>
                  <input
                    ref={photoInput}
                    id="report-photos"
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => addPhotos(e.target.files)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                        <img src={p.url} alt={t("report.photoAlt", { n: i + 1 })} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          aria-label={t("report.removePhoto", { n: i + 1 })}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-20 w-20 flex-col gap-1 text-xs"
                        onClick={() => photoInput.current?.click()}
                      >
                        <ImagePlus className="h-5 w-5" />
                        {t("report.addPhotos")}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("report.photosHint")}</p>
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

                {user?.mapSuspended && (
                  <p role="status" className="rounded-xl bg-warning/10 p-3 text-sm">
                    {t("report.suspended")}
                  </p>
                )}
                {user && !user.mapSuspended && !(formData.anonymous || !user) && (!user.emailVerified || !user.phone) && (
                  <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                    {t("report.verifyHint")}{" "}
                    <Link to="/account" className="font-semibold text-primary underline underline-offset-2">
                      {t("report.verifyLink")}
                    </Link>
                  </p>
                )}

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
