import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STATUS_STYLE, categoryKey, statusKey, type Message, type Status } from "./types";

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export const StatusPill = ({ status }: { status: Status }) => {
  const { t } = useI18n();
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1", STATUS_STYLE[status])}>{t(statusKey(status))}</span>;
};

export const CategoryLabel = ({ category }: { category: string }) => {
  const { t } = useI18n();
  return <>{t(categoryKey(category))}</>;
};

// The conversation between the reporter and HR. `asHr` decides whose messages sit on the right.
const Thread = ({ reportId, messages, asHr, onSent }: { reportId: number; messages: Message[]; asHr: boolean; onSent: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(`/api/workplace/reports/${reportId}/messages`, {
        body: { body: text.trim() },
      });
      setText("");
      onSent();
    } catch (err) {
      toast({
        title: t("work.sendFailed"),
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {messages.length > 0 && (
        <ol className="space-y-2" aria-label={t("work.thread")}>
          {messages.map((m, i) => {
            const mine = m.fromHr === asHr;
            return (
              <li key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <p className="text-xs font-semibold opacity-80">
                    {m.fromHr ? t("work.fromHr") : asHr ? t("work.fromEmployee") : t("work.fromYou")}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[11px] opacity-70">{when(m.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={send} className="flex items-end gap-2">
        <label htmlFor={`reply-${reportId}`} className="sr-only">
          {asHr ? t("work.replyAsHr") : t("work.replyToHr")}
        </label>
        <Textarea
          id={`reply-${reportId}`}
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={asHr ? t("work.replyAsHr") : t("work.replyToHr")}
          className="min-h-[3rem] flex-1"
        />
        <Button type="submit" variant="hero" size="icon" disabled={sending || !text.trim()} aria-label={t("work.send")}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default Thread;
