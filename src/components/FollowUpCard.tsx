import { useState } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speechLocale, useI18n } from "@/i18n";
import { answerFollowUp, dueFollowUp, stopFollowUp, type Feeling, type FollowUp } from "@/lib/followUp";
import { syncFollowUpNotifications } from "@/lib/followUpNotifications";

// "How are you doing?" the day after an SOS or a report, and a few days later. Feeling the same
// or worse days on is common; it offers people to talk to, never a diagnosis.
const FollowUpCard = () => {
  const { t, lang } = useI18n();
  const [followUp, setFollowUp] = useState<FollowUp | null>(() => dueFollowUp());
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  if (!followUp) return null;

  const when = new Date(followUp.eventAt).toLocaleDateString(speechLocale(lang), { weekday: "long" });
  const notify = { title: t("follow.notifyTitle"), body: t("follow.notifyBody") };
  const answer = (f: Feeling) => {
    setFeeling(f);
    answerFollowUp(followUp.id);
    void syncFollowUpNotifications(notify);
  };
  const stop = () => {
    stopFollowUp(followUp.id);
    void syncFollowUpNotifications(notify);
    setFollowUp(null);
  };

  return (
    <section aria-labelledby="follow-title" className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <h2 id="follow-title" className="flex items-center gap-2 font-bold">
        <HeartHandshake className="h-5 w-5 text-primary" />
        {t(followUp.kind === "sos" ? "follow.titleSos" : "follow.titleReport", { day: when })}
      </h2>
      {!feeling ? (
        <>
          <p className="text-sm">{t("follow.ask")}</p>
          <div className="flex flex-wrap gap-2">
            {(["better", "same", "worse"] as const).map((f) => (
              <Button key={f} type="button" variant="outline" onClick={() => answer(f)}>
                {t(`follow.${f}`)}
              </Button>
            ))}
          </div>
        </>
      ) : feeling === "better" ? (
        <p className="text-sm">{t("follow.betterReply")}</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p>{t("follow.notBetterReply")}</p>
          <div className="flex flex-wrap gap-2">
            <a href="tel:14416">
              <Button type="button" variant="hero" size="sm" className="gap-2">
                <Phone className="h-4 w-4" /> {t("wb.callTeleManas")}
              </Button>
            </a>
            <Link to="/partners">
              <Button type="button" variant="outline" size="sm">
                {t("follow.counsellor")}
              </Button>
            </Link>
            <Link to="/support">
              <Button type="button" variant="outline" size="sm">
                {t("follow.talk")}
              </Button>
            </Link>
            {followUp.kind === "sos" && (
              <Link to="/help#after-assault">
                <Button type="button" variant="outline" size="sm">
                  {t("help.afterAssaultLink")}
                </Button>
              </Link>
            )}
            {followUp.kind === "sos" && (
              <Link to="/report">
                <Button type="button" variant="outline" size="sm">
                  {t("follow.writeItDown")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        {feeling && (
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setFollowUp(null)}>
            {t("follow.close")}
          </button>
        )}
        <button type="button" className="text-muted-foreground underline-offset-2 hover:underline" onClick={stop}>
          {t("follow.stop")}
        </button>
      </div>
    </section>
  );
};

export default FollowUpCard;
