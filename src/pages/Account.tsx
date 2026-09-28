import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import LoadingRows from "@/components/LoadingRows";
import { ShieldCheck, Users } from "lucide-react";
import ReportPhotos from "@/components/ReportPhotos";
import PhoneVerification from "@/components/PhoneVerification";
import SafetyAtHome from "@/components/SafetyAtHome";
import SosRecordings from "@/components/SosRecordings";
import EmergencyInfoSettings from "@/components/EmergencyInfoSettings";
import SavedPlaces from "@/components/SavedPlaces";

const REPORT_TYPES = ["harassment", "assault", "stalking", "threat", "discrimination", "other"];

type Report = {
  id: number;
  incidentType: string;
  description: string;
  location: string | null;
  date: string | null;
  createdAt: string;
  photos?: number[];
};

const Account = () => {
  const { user, loading, clearSession } = useAuth();
  const { toast } = useToast();
  const { t, tr } = useI18n();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[] | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login?next=/account", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api<{ reports: Report[] }>("/api/reports")
      .then((res) => setReports(res.reports))
      .catch(() => setReports([]));
  }, [user]);

  const deleteReport = async (id: number) => {
    try {
      await api(`/api/reports/${id}`, { method: "DELETE" });
      setReports((prev) => prev?.filter((r) => r.id !== id) ?? null);
      toast({ title: t("account.reportDeleted") });
    } catch (err) {
      toast({ title: t("account.reportDeleteFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChanging(true);
    try {
      // The server swaps in a fresh session cookie and signs out other devices.
      await api("/api/account/password", { body: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: t("account.passwordChangedTitle"), description: t("account.passwordChangedDesc") });
    } catch (err) {
      toast({ title: t("account.passwordChangeFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setChanging(false);
    }
  };

  const downloadData = async () => {
    try {
      const data = await api<unknown>("/api/account/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "herspace-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: t("account.downloadFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", body: { password: deletePassword } });
      clearSession();
      toast({ title: t("account.deletedTitle"), description: t("account.deletedDesc") });
      navigate("/");
    } catch (err) {
      toast({ title: t("account.deleteFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-6">
          <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-brand/10 p-6 shadow-card">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-2xl font-extrabold text-white shadow-raised"
              >
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-muted-foreground">{t("account.title")}</h1>
                <p className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{user.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/contacts">
                <Button variant="outline" size="sm" className="gap-2 bg-card">
                  <Users className="h-4 w-4" /> {t("nav.emergencyContacts")}
                </Button>
              </Link>
              {user.moderator && (
                <Link to="/moderation">
                  <Button variant="outline" size="sm" className="gap-2 bg-card">
                    <ShieldCheck className="h-4 w-4" /> {t("nav.moderation")}
                  </Button>
                </Link>
              )}
            </div>
          </section>

          <PhoneVerification />

          <SafetyAtHome />

          <EmergencyInfoSettings />

          <SavedPlaces />

          <SosRecordings />

          <Card>
            <CardHeader>
              <CardTitle>{t("account.reportsTitle")}</CardTitle>
              <CardDescription>{t("account.reportsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reports === null && <LoadingRows tall />}
              {reports?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {tr("account.noReports", {
                    link: (
                      <Link to="/report" className="text-primary underline">
                        {t("map.reportButton")}
                      </Link>
                    ),
                  })}
                </p>
              )}
              {reports?.map((r) => (
                <div key={r.id} className="rounded-md border border-border/50 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {REPORT_TYPES.includes(r.incidentType) ? t(`report.types.${r.incidentType}` as MessageKey) : r.incidentType}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => deleteReport(r.id)}>
                      {t("common.delete")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.date ? `${t("account.happened", { date: new Date(r.date).toLocaleDateString() })} · ` : ""}
                    {t("account.reported", { date: new Date(r.createdAt).toLocaleDateString() })}
                    {r.location ? ` · ${r.location}` : ""}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{r.description}</p>
                  <ReportPhotos reportId={r.id} photos={r.photos ?? []} />
                  <Link to={`/complaint?report=${r.id}`} className="inline-block pt-1 text-sm font-semibold text-primary underline underline-offset-2">
                    {t("account.writeComplaint")}
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("account.passwordTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={changePassword}>
                <Input
                  type="password"
                  aria-label={t("account.currentPassword")}
                  autoComplete="current-password"
                  placeholder={t("account.currentPassword")}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  aria-label={t("reset.new")}
                  autoComplete="new-password"
                  placeholder={t("account.newPassword")}
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button type="submit" variant="hero" disabled={changing}>
                  {changing ? t("common.saving") : t("account.changePassword")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("account.dataTitle")}</CardTitle>
              <CardDescription>{t("account.dataDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadData}>
                {t("account.download")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>{t("account.deleteTitle")}</CardTitle>
              <CardDescription>{t("account.deleteDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {!confirmDelete ? (
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  {t("account.deleteButton")}
                </Button>
              ) : (
                <form className="space-y-3" onSubmit={deleteAccount}>
                  <Input
                    type="password"
                    aria-label={t("common.password")}
                    autoComplete="current-password"
                    placeholder={t("account.deletePassword")}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" disabled={deleting}>
                      {deleting ? t("account.deleting") : t("account.deleteConfirm")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeletePassword("");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Account;
