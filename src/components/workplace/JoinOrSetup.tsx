import { useState } from "react";
import { Building2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { Org } from "./types";

// For someone signed in who isn't part of a workplace yet: join with a code, or (HR) set one up.
const JoinOrSetup = ({ onJoined, onCreated }: { onJoined: (org: Org) => void; onCreated: (org: Org, code: string) => void }) => {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [setupError, setSetupError] = useState("");
  const [creating, setCreating] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      const res = await api<{ org: Org }>("/api/workplace/join", {
        body: { code },
      });
      onJoined(res.org);
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setJoining(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");
    setCreating(true);
    try {
      const res = await api<{ org: Org; joinCode: string }>("/api/workplace/orgs", { body: { name, emailDomain: domain.trim() } });
      onCreated(res.org, res.joinCode);
    } catch (err) {
      setSetupError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={join} className="flex flex-col gap-5 rounded-[2rem] bg-card p-8 shadow-card ring-1 ring-border">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
          <KeyRound className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold">{t("work.joinTitle")}</h2>
          <p className="mt-1 text-muted-foreground">{t("work.joinText")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-code">{t("work.joinCode")}</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD EFGH"
            autoComplete="off"
            maxLength={20}
            className="font-mono text-lg tracking-widest"
          />
        </div>
        {joinError && (
          <p role="alert" className="text-sm text-destructive">
            {joinError}
          </p>
        )}
        <Button type="submit" variant="hero" size="lg" className="mt-auto" disabled={joining || code.replace(/\s/g, "").length < 6}>
          {joining ? t("work.joining") : t("work.join")}
        </Button>
      </form>

      <form onSubmit={create} className="flex flex-col gap-5 rounded-[2rem] bg-card p-8 shadow-card ring-1 ring-border">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold">{t("work.setupTitle")}</h2>
          <p className="mt-1 text-muted-foreground">{t("work.setupText")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-name">{t("work.orgName")}</Label>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-domain">{t("work.orgDomain")}</Label>
          <Input id="org-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com" maxLength={100} />
          <p className="text-sm text-muted-foreground">{t("work.orgDomainHint")}</p>
        </div>
        {setupError && (
          <p role="alert" className="text-sm text-destructive">
            {setupError}
          </p>
        )}
        <Button type="submit" variant="glass" size="lg" className="mt-auto" disabled={creating || name.trim().length < 2}>
          {creating ? t("work.creating") : t("work.create")}
        </Button>
      </form>
    </div>
  );
};

export default JoinOrSetup;
