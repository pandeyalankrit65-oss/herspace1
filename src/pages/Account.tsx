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

type Report = { id: number; incidentType: string; description: string; location: string | null; date: string | null; createdAt: string };

const Account = () => {
  const { user, loading, clearSession } = useAuth();
  const { toast } = useToast();
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
      toast({ title: "Report deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete report", description: (err as Error).message, variant: "destructive" });
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
      toast({ title: "Password changed", description: "You've been signed out on other devices." });
    } catch (err) {
      toast({ title: "Couldn't change password", description: (err as Error).message, variant: "destructive" });
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
      toast({ title: "Couldn't download data", description: (err as Error).message, variant: "destructive" });
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", body: { password: deletePassword } });
      clearSession();
      toast({ title: "Account deleted", description: "Your account and personal data have been removed." });
      navigate("/");
    } catch (err) {
      toast({ title: "Couldn't delete account", description: (err as Error).message, variant: "destructive" });
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
          <div>
            <h1 className="text-3xl font-bold">Your account</h1>
            <p className="text-muted-foreground">
              {user.name} · {user.email}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your reports</CardTitle>
              <CardDescription>Reports you submitted while logged in. Anonymous reports aren't linked to you, so they don't appear here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reports === null && <p className="text-sm text-muted-foreground">Loading...</p>}
              {reports?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No reports yet. <Link to="/report" className="text-primary underline">Report an incident</Link>
                </p>
              )}
              {reports?.map((r) => (
                <div key={r.id} className="rounded-md border border-border/50 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{r.incidentType}</span>
                    <Button variant="ghost" size="sm" onClick={() => deleteReport(r.id)}>Delete</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.date ? `Happened ${new Date(r.date).toLocaleDateString()} · ` : ""}Reported {new Date(r.createdAt).toLocaleDateString()}
                    {r.location ? ` · ${r.location}` : ""}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{r.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={changePassword}>
                <Input type="password" aria-label="Current password" autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <Input type="password" aria-label="New password" autoComplete="new-password" placeholder="New password (at least 8 characters)" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <Button type="submit" variant="hero" disabled={changing}>{changing ? "Saving..." : "Change password"}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your data</CardTitle>
              <CardDescription>Download a copy of everything HerSpace stores about you: account, contacts, reports and SOS history.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadData}>Download my data</Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Delete account</CardTitle>
              <CardDescription>
                Permanently deletes your account, emergency contacts, reports and SOS history. This can't be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!confirmDelete ? (
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>Delete my account</Button>
              ) : (
                <form className="space-y-3" onSubmit={deleteAccount}>
                  <Input type="password" aria-label="Password" autoComplete="current-password" placeholder="Enter your password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required />
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" disabled={deleting}>{deleting ? "Deleting..." : "Permanently delete"}</Button>
                    <Button type="button" variant="ghost" onClick={() => { setConfirmDelete(false); setDeletePassword(""); }}>Cancel</Button>
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
