import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

export type EmergencyInfo = { bloodGroup: string; allergies: string; medications: string; conditions: string; notes: string };

const EMPTY: EmergencyInfo = { bloodGroup: "", allergies: "", medications: "", conditions: "", notes: "" };
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const FIELDS = ["allergies", "medications", "conditions", "notes"] as const;

// Blood group, allergies and so on, for whoever reaches her first in an emergency. Health
// details are sensitive: contacts only see them on the live link of an active SOS, and only
// if she turns sharing on.
const EmergencyInfoSettings = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [info, setInfo] = useState<EmergencyInfo>(EMPTY);
  const [share, setShare] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ info: EmergencyInfo | null; share: boolean }>("/api/account/emergency-info")
      .then((r) => {
        setInfo({ ...EMPTY, ...r.info });
        setShare(r.share);
        setLoaded(true);
      })
      .catch(() => {});
  }, []);

  const empty = Object.values(info).every((v) => !v.trim());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api<{ info: EmergencyInfo | null; share: boolean }>("/api/account/emergency-info", {
        method: "PUT",
        body: { info, share },
      });
      setInfo({ ...EMPTY, ...r.info });
      setShare(r.share);
      toast({ title: t("medical.saved"), description: r.share ? t("medical.savedShared") : t("medical.savedPrivate") });
    } catch (err) {
      toast({ title: t("medical.saveFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof EmergencyInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setInfo((i) => ({ ...i, [key]: e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" /> {t("medical.title")}
        </CardTitle>
        <CardDescription>{t("medical.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <div className="space-y-1">
            <Label htmlFor="medical-bloodGroup">{t("medical.bloodGroup")}</Label>
            <select
              id="medical-bloodGroup"
              value={info.bloodGroup}
              onChange={set("bloodGroup")}
              disabled={!loaded}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("medical.bloodUnknown")}</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          {FIELDS.map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`medical-${key}`}>{t(`medical.${key}`)}</Label>
              <Input
                id={`medical-${key}`}
                value={info[key]}
                maxLength={300}
                placeholder={t(`medical.${key}Placeholder`)}
                onChange={set(key)}
                disabled={!loaded}
              />
            </div>
          ))}
          <div className="flex items-start gap-3 rounded-xl border p-3 sm:col-span-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="medical-share" className="font-semibold">
                {t("medical.shareTitle")}
              </label>
              <p className="text-sm text-muted-foreground">{t("medical.shareDesc")}</p>
            </div>
            <Switch id="medical-share" checked={share && !empty} disabled={!loaded || empty} onCheckedChange={setShare} />
          </div>
          <Button type="submit" variant="hero" className="sm:col-span-2 sm:w-fit" disabled={!loaded || saving}>
            {saving ? t("common.saving") : t("medical.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default EmergencyInfoSettings;
