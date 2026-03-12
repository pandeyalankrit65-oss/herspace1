import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

const LS_KEY = "herspace_contacts";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const Contacts = () => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setContacts(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(contacts));
  }, [contacts]);

  const hasContacts = useMemo(() => contacts.length > 0, [contacts]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setRelation("");
    setEditing(null);
  };

  const validate = () => {
    if (!name.trim()) return "Name is required";
    if (!phone.trim()) return "Phone is required";
    if (!/^\+?[0-9\-\s]{7,15}$/.test(phone.trim())) return "Enter a valid phone number";
    return "";
  };

  const onSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Invalid input", description: err, variant: "destructive" });
      return;
    }
    if (editing) {
      setContacts((prev) => prev.map((c) => (c.id === editing.id ? { ...c, name: name.trim(), phone: phone.trim(), relation: relation.trim() } : c)));
      toast({ title: "Contact updated" });
    } else {
      const contact: Contact = { id: uid(), name: name.trim(), phone: phone.trim(), relation: relation.trim() };
      setContacts((prev) => [...prev, contact]);
      toast({ title: "Contact added" });
    }
    setOpen(false);
    resetForm();
  };

  const onEdit = (c: Contact) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setRelation(c.relation || "");
    setOpen(true);
  };

  const onDelete = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Contact removed" });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Emergency Contacts</CardTitle>
                <CardDescription>Add trusted contacts who will be notified during emergencies</CardDescription>
              </div>
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button variant="hero">{editing ? "Edit Contact" : "Add Contact"}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editing ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={onSubmit}>
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555-123-4567" required />
                    </div>
                    <div>
                      <Label htmlFor="relation">Relation (optional)</Label>
                      <Input id="relation" value={relation} onChange={(e) => setRelation(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                      <Button type="submit" variant="hero">{editing ? "Save Changes" : "Add"}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!hasContacts && (
                <p className="text-sm text-muted-foreground">No contacts yet. Add at least one trusted contact.</p>
              )}
              {hasContacts && (
                <div className="space-y-3">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border border-border/50 p-3">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-muted-foreground">{c.phone}{c.relation ? ` • ${c.relation}` : ""}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onEdit(c)}>Edit</Button>
                        <Button variant="destructive" onClick={() => onDelete(c.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contacts;
