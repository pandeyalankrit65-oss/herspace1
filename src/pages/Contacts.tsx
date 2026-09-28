import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, MessageSquare, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { offlineContacts } from "@/lib/offline";
import { useI18n } from "@/i18n";
import LoadingRows from "@/components/LoadingRows";
import PageHeader from "@/components/PageHeader";
import NeedsInternet from "@/components/NeedsInternet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ContactStatus = "pending" | "confirmed" | "declined";

export interface Contact {
  id: number;
  name: string;
  phone: string;
  relation?: string | null;
  status: ContactStatus;
}

type InviteResult = { inviteLink: string; inviteSms: "sent" | "failed" | "not_configured"; inviteError?: string };
type PendingInvite = InviteResult & { contact: Pick<Contact, "name" | "phone"> };

const STATUS_BADGE: Record<
  ContactStatus,
  { label: "contacts.status.confirmed" | "contacts.status.pending" | "contacts.status.declined"; className: string }
> = {
  confirmed: { label: "contacts.status.confirmed", className: "border-success/40 bg-success/10 text-success" },
  pending: { label: "contacts.status.pending", className: "border-warning/50 bg-warning/10 text-foreground" },
  declined: { label: "contacts.status.declined", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

const AVATAR: Record<ContactStatus, string> = {
  confirmed: "bg-success/15 text-success",
  pending: "bg-warning/15 text-foreground",
  declined: "bg-muted text-muted-foreground",
};

// Contacts saved by the old browser-only version of the app.
const LEGACY_KEY = "herspace_contacts";
const readLegacyContacts = (): Array<{ name: string; phone: string; relation?: string }> => {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const Contacts = () => {
  const { toast } = useToast();
  const { t, tn } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [legacy, setLegacy] = useState(readLegacyContacts);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [testing, setTesting] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ contacts: Contact[] }>("/api/contacts");
      setContacts(res.contacts);
      offlineContacts.set(res.contacts);
    } catch (err) {
      // Offline: show the copy kept on this phone (the notice above explains why it can't change).
      if (err instanceof ApiError && err.status === 0) setContacts(offlineContacts.get<Contact>());
      else toast({ title: t("contacts.loadFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoaded(true);
    }
  }, [toast, t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setRelation("");
    setEditing(null);
  };

  const onSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const body = { name, phone, relation };
      const res = editing
        ? await api<{ contact: Contact } & Partial<InviteResult>>(`/api/contacts/${editing.id}`, { method: "PUT", body })
        : await api<{ contact: Contact } & InviteResult>("/api/contacts", { body });
      await load();
      if (res.inviteLink) {
        setInvite({ ...(res as InviteResult), contact: res.contact });
      } else {
        setOpen(false);
        toast({ title: t("contacts.updated") });
      }
    } catch (err) {
      toast({ title: t("contacts.saveFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Content is reset when the dialog opens, never while it animates closed.
  const openAdd = () => {
    resetForm();
    setInvite(null);
    setOpen(true);
  };

  const onEdit = (c: Contact) => {
    setInvite(null);
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setRelation(c.relation || "");
    setOpen(true);
  };

  const onDelete = async (id: number) => {
    try {
      await api(`/api/contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast({ title: t("contacts.removed") });
    } catch (err) {
      toast({ title: t("contacts.removeFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const onResend = async (c: Contact) => {
    try {
      const res = await api<InviteResult>(`/api/contacts/${c.id}/resend`, { method: "POST" });
      setInvite({ ...res, contact: c });
      setOpen(true);
      await load();
    } catch (err) {
      toast({ title: t("contacts.resendFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const onTestAlert = async () => {
    setTesting(true);
    try {
      const res = await api<{ deliveries: Array<{ status: string }> }>("/api/sos/test", { method: "POST" });
      const sent = res.deliveries.filter((d) => d.status === "sent").length;
      toast(
        sent > 0
          ? {
              title: t("contacts.testSentTitle"),
              description: tn("contacts.testSentDesc", sent),
            }
          : {
              title: t("contacts.testNotSentTitle"),
              description: t("contacts.testNotSentDesc"),
              variant: "destructive",
            },
      );
    } catch (err) {
      toast({ title: t("contacts.testFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const importLegacy = async () => {
    const failed: string[] = [];
    for (const c of legacy) {
      try {
        await api("/api/contacts", { body: { name: c.name, phone: c.phone, relation: c.relation || "" } });
      } catch (err) {
        failed.push(`${c.name}: ${(err as Error).message}`);
      }
    }
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    setLegacy([]);
    await load();
    toast(
      failed.length
        ? { title: t("contacts.importFixTitle"), description: failed.join("\n"), variant: "destructive" }
        : { title: t("contacts.importedTitle"), description: t("contacts.importedDesc") },
    );
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>{t("contacts.title")}</CardTitle>
                <CardDescription>{t("contacts.loginDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Link to="/login?next=/contacts" className="flex-1">
                  <Button variant="hero" className="w-full">
                    {t("common.logIn")}
                  </Button>
                </Link>
                <Link to="/signup?next=/contacts" className="flex-1">
                  <Button variant="outline" className="w-full">
                    {t("common.signUp")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const confirmedCount = contacts.filter((c) => c.status === "confirmed").length;
  const shareText = invite ? t("contacts.shareText", { user: user?.name ?? "", link: invite.inviteLink }) : "";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-4">
          {legacy.length > 0 && (
            <Card className="border-primary/40">
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
                <p className="text-sm">{tn("contacts.legacy", legacy.length)}</p>
                <Button variant="hero" onClick={importLegacy}>
                  {t("contacts.import")}
                </Button>
              </CardContent>
            </Card>
          )}
          <PageHeader icon={Users} title={t("contacts.title")} subtitle={t("contacts.desc")}>
            <Button variant="hero" className="w-full gap-2 sm:w-auto" onClick={openAdd}>
              <Plus className="h-4 w-4" /> {t("contacts.add")}
            </Button>
          </PageHeader>

          <NeedsInternet message="offline.contacts" />

          <Card className="overflow-hidden">
            {!loaded && (
              <CardContent className="pt-6">
                <LoadingRows />
              </CardContent>
            )}
            {loaded && contacts.length === 0 && (
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-6 w-6" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">{t("contacts.empty")}</p>
              </CardContent>
            )}
            {contacts.length > 0 && (
              <ul className="divide-y">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 p-4">
                    <span
                      aria-hidden
                      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold", AVATAR[c.status])}
                    >
                      {c.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.phone}
                        {c.relation ? ` · ${c.relation}` : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                        <Badge variant="outline" className={cn("font-medium", STATUS_BADGE[c.status].className)}>
                          {t(STATUS_BADGE[c.status].label)}
                        </Badge>
                        {c.status !== "confirmed" && (
                          <button type="button" onClick={() => onResend(c)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline">
                            <Send className="h-3.5 w-3.5" /> {t("contacts.resend")}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="-mr-2 flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label={t("contacts.editName", { name: c.name })} onClick={() => onEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("contacts.removeName", { name: c.name })}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRemoving(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {confirmedCount > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
                <p className="text-sm">{t("contacts.testPrompt")}</p>
                <Button variant="hero" onClick={onTestAlert} disabled={testing} className="gap-2 shrink-0">
                  <Send className="h-4 w-4" />
                  {testing ? t("contacts.sendingTest") : t("contacts.sendTest")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contacts.removeTitle", { name: removing?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("contacts.removeDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removing && onDelete(removing.id)}
            >
              {t("contacts.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {invite ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("contacts.inviteTitle", { name: invite.contact.name })}</DialogTitle>
                <DialogDescription>
                  {invite.inviteSms === "sent"
                    ? t("contacts.inviteSent", { name: invite.contact.name })
                    : t("contacts.inviteNotSent", { name: invite.contact.name })}
                </DialogDescription>
              </DialogHeader>
              {invite && (
                <div className="space-y-3">
                  <Input readOnly value={invite.inviteLink} onFocus={(e) => e.target.select()} />
                  <div className="grid sm:grid-cols-3 gap-2">
                    <a href={`sms:${invite.contact.phone}?&body=${encodeURIComponent(shareText)}`}>
                      <Button variant="hero" className="w-full gap-2">
                        <MessageSquare className="h-4 w-4" /> {t("common.text")}
                      </Button>
                    </a>
                    <a
                      href={`https://wa.me/${invite.contact.phone.replace("+", "")}?text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button variant="outline" className="w-full">
                        {t("common.whatsapp")}
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(shareText)
                          .then(() => toast({ title: t("common.copied") }))
                          .catch(() =>
                            toast({
                              title: t("contacts.copyFailedTitle"),
                              description: t("contacts.copyFailedDesc"),
                              variant: "destructive",
                            }),
                          )
                      }
                    >
                      <Copy className="h-4 w-4" /> {t("common.copy")}
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  {t("common.done")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{editing ? t("contacts.editTitle") : t("contacts.addTitle")}</DialogTitle>
                {!editing && <DialogDescription>{t("contacts.addDesc")}</DialogDescription>}
              </DialogHeader>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <Label htmlFor="name">{t("common.name")}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="phone">{t("contacts.phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("contacts.phonePlaceholder")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="relation">{t("contacts.relation")}</Label>
                  <Input id="relation" value={relation} onChange={(e) => setRelation(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="hero" disabled={saving}>
                    {saving ? t("common.saving") : editing ? t("contacts.saveButton") : t("contacts.addButton")}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default Contacts;
