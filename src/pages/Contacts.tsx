import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, MessageSquare, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

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

const STATUS_BADGE: Record<ContactStatus, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-green-500/15 text-green-600 border-green-500/40" },
  pending: { label: "Waiting for confirmation", className: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  declined: { label: "Declined", className: "bg-destructive/15 text-destructive border-destructive/40" },
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
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [legacy, setLegacy] = useState(readLegacyContacts);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
    } catch (err) {
      toast({ title: "Couldn't load contacts", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoaded(true);
    }
  }, [toast]);

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
      setOpen(false);
      resetForm();
      await load();
      if (res.inviteLink) setInvite({ ...(res as InviteResult), contact: res.contact });
      else toast({ title: "Contact updated" });
    } catch (err) {
      toast({ title: "Couldn't save contact", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (c: Contact) => {
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
      toast({ title: "Contact removed" });
    } catch (err) {
      toast({ title: "Couldn't remove contact", description: (err as Error).message, variant: "destructive" });
    }
  };

  const onResend = async (c: Contact) => {
    try {
      const res = await api<InviteResult>(`/api/contacts/${c.id}/resend`, { method: "POST" });
      setInvite({ ...res, contact: c });
      await load();
    } catch (err) {
      toast({ title: "Couldn't resend invite", description: (err as Error).message, variant: "destructive" });
    }
  };

  const onTestAlert = async () => {
    setTesting(true);
    try {
      const res = await api<{ deliveries: Array<{ status: string }> }>("/api/sos/test", { method: "POST" });
      const sent = res.deliveries.filter((d) => d.status === "sent").length;
      toast(
        sent > 0
          ? { title: "Test alert sent", description: `${sent} confirmed contact${sent === 1 ? "" : "s"} should get a test SMS now. Ask them if it arrived.` }
          : {
              title: "Test alert not delivered",
              description: "No SMS was sent. Either no contact has confirmed yet, or SMS isn't set up on this server.",
              variant: "destructive",
            }
      );
    } catch (err) {
      toast({ title: "Couldn't send test", description: (err as Error).message, variant: "destructive" });
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
        ? { title: "Some contacts need fixing", description: failed.join("\n"), variant: "destructive" }
        : { title: "Contacts imported", description: "Each one needs to confirm before they'll receive alerts." }
    );
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-md">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Emergency Contacts</CardTitle>
                <CardDescription>
                  Log in to save trusted contacts. They're stored on your account so SOS alerts can reach them from any device.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Link to="/login?next=/contacts" className="flex-1">
                  <Button variant="hero" className="w-full">Log in</Button>
                </Link>
                <Link to="/signup?next=/contacts" className="flex-1">
                  <Button variant="outline" className="w-full">Sign up</Button>
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
  const shareText = invite
    ? `${user?.name ?? "I"} added you as an emergency contact on HerSpace. Please confirm here: ${invite.inviteLink}`
    : "";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-4">
          {legacy.length > 0 && (
            <Card className="border-primary/40">
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
                <p className="text-sm">
                  {legacy.length} contact{legacy.length === 1 ? " is" : "s are"} saved only in this browser from an older version. Import them into your account?
                </p>
                <Button variant="hero" onClick={importLegacy}>Import</Button>
              </CardContent>
            </Card>
          )}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Emergency Contacts</CardTitle>
                <CardDescription>
                  Confirmed contacts get an SMS with your location when you trigger SOS. Each person has to agree first, so
                  they know what the message means when it arrives.
                </CardDescription>
              </div>
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button variant="hero" className="shrink-0">Add Contact</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editing ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                    {!editing && (
                      <DialogDescription>We'll send them a link to confirm they're happy to be your emergency contact.</DialogDescription>
                    )}
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={onSubmit}>
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone (with country code)</Label>
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" required />
                    </div>
                    <div>
                      <Label htmlFor="relation">Relation (optional)</Label>
                      <Input id="relation" value={relation} onChange={(e) => setRelation(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                      <Button type="submit" variant="hero" disabled={saving}>
                        {saving ? "Saving..." : editing ? "Save Changes" : "Add"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!loaded && <p className="text-sm text-muted-foreground">Loading...</p>}
              {loaded && contacts.length === 0 && (
                <p className="text-sm text-muted-foreground">No contacts yet. Add at least one trusted contact.</p>
              )}
              {contacts.length > 0 && (
                <div className="space-y-3">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-border/50 p-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate">{c.name}</span>
                          <Badge variant="outline" className={STATUS_BADGE[c.status].className}>
                            {STATUS_BADGE[c.status].label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{c.phone}{c.relation ? ` • ${c.relation}` : ""}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {c.status !== "confirmed" && (
                          <Button variant="outline" size="sm" onClick={() => onResend(c)}>Resend invite</Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => onEdit(c)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(c.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {confirmedCount > 0 && (
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
                <p className="text-sm">
                  Make sure alerts actually reach your contacts. A test sends them a message clearly marked as a test.
                </p>
                <Button variant="hero" onClick={onTestAlert} disabled={testing} className="gap-2 shrink-0">
                  <Send className="h-4 w-4" />
                  {testing ? "Sending..." : "Send test alert"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={invite !== null} onOpenChange={(v) => !v && setInvite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask {invite?.contact.name} to confirm</DialogTitle>
            <DialogDescription>
              {invite?.inviteSms === "sent"
                ? `We've texted ${invite.contact.name} a confirmation link. You can also send it yourself so they know it's really from you.`
                : `We couldn't text ${invite?.contact.name} automatically. Send them this link yourself. They won't receive SOS alerts until they confirm.`}
            </DialogDescription>
          </DialogHeader>
          {invite && (
            <div className="space-y-3">
              <Input readOnly value={invite.inviteLink} onFocus={(e) => e.target.select()} />
              <div className="grid sm:grid-cols-3 gap-2">
                <a href={`sms:${invite.contact.phone}?&body=${encodeURIComponent(shareText)}`}>
                  <Button variant="hero" className="w-full gap-2"><MessageSquare className="h-4 w-4" /> Text</Button>
                </a>
                <a href={`https://wa.me/${invite.contact.phone.replace("+", "")}?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full">WhatsApp</Button>
                </a>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(shareText)
                      .then(() => toast({ title: "Copied" }))
                      .catch(() => toast({ title: "Couldn't copy", description: "Select the link and copy it manually.", variant: "destructive" }))
                  }
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default Contacts;
