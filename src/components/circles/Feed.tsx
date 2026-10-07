import { useState } from "react";
import { EyeOff, Flag, MessageCircle, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FLAG_REASONS, POST_KINDS, POST_STYLE, postKindKey, reasonKey, when, type Item, type Post, type PostKind } from "./types";

// Delete (your own, or anything if you moderate) and flag (anyone else's).
const ItemMenu = ({
  circleId,
  item,
  target,
  canModerate,
  onChange,
}: {
  circleId: number;
  item: Item;
  target: "post" | "comment";
  canModerate: boolean;
  onChange: () => void;
}) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast({ title: done });
      onChange();
    } catch (err) {
      toast({ title: t("circles.actionFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };
  const remove = () =>
    run(() => api(`/api/circles/${circleId}/${target === "post" ? "posts" : "comments"}/${item.id}`, { method: "DELETE" }), t("circles.deleted"));
  const flag = (reason: string) => run(() => api(`/api/circles/${circleId}/flag`, { body: { target, id: item.id, reason } }), t("circles.flagged"));
  if (!item.mine && !canModerate && item.flagged) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={target === "post" ? t("circles.postOptions") : t("circles.commentOptions")}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(item.mine || canModerate) && (
          <DropdownMenuItem onSelect={remove} className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> {t("circles.delete")}
          </DropdownMenuItem>
        )}
        {!item.mine && !item.flagged && (
          <>
            {(item.mine || canModerate) && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2">
              <Flag className="h-4 w-4" /> {t("circles.flagAs")}
            </DropdownMenuLabel>
            {FLAG_REASONS.map((r) => (
              <DropdownMenuItem key={r} onSelect={() => flag(r)}>
                {t(reasonKey(r))}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Author = ({ item }: { item: Item }) => {
  const { t } = useI18n();
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm">
      <span className="font-semibold">
        {item.author ?? (
          <span className="inline-flex items-center gap-1">
            <EyeOff className="h-3.5 w-3.5" /> {t("circles.anonymousMember")}
          </span>
        )}
      </span>
      {item.mine && <span className="text-muted-foreground">({item.author ? t("circles.you") : t("circles.youAnonymously")})</span>}
      <span className="text-muted-foreground">· {when(item.at)}</span>
    </p>
  );
};

const HiddenNote = () => {
  const { t } = useI18n();
  return <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{t("circles.hiddenNote")}</p>;
};

const Comments = ({ circleId, post, canModerate, onChange }: { circleId: number; post: Post; canModerate: boolean; onChange: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api(`/api/circles/${circleId}/posts/${post.id}/comments`, { body: { body: text.trim(), anonymous } });
      setText("");
      onChange();
    } catch (err) {
      toast({ title: t("circles.actionFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="space-y-3 border-t border-border pt-4">
      {post.comments.map((c) => (
        <div key={c.id} className="flex gap-2 rounded-2xl bg-muted/50 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Author item={c} />
            {c.hidden && <HiddenNote />}
            <p className="whitespace-pre-wrap break-words">{c.body}</p>
          </div>
          <ItemMenu circleId={circleId} item={c} target="comment" canModerate={canModerate} onChange={onChange} />
        </div>
      ))}
      <form onSubmit={send} className="space-y-2">
        <div className="flex items-end gap-2">
          <label htmlFor={`comment-${post.id}`} className="sr-only">
            {t("circles.comment")}
          </label>
          <Textarea
            id={`comment-${post.id}`}
            rows={1}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("circles.comment")}
            className="min-h-[2.75rem] flex-1"
          />
          <Button type="submit" variant="hero" size="icon" disabled={sending || !text.trim()} aria-label={t("circles.sendComment")}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {text.trim() && (
          <div className="flex items-center gap-2 text-sm">
            <Switch id={`comment-anon-${post.id}`} checked={anonymous} onCheckedChange={setAnonymous} />
            <label htmlFor={`comment-anon-${post.id}`}>{t("circles.anonymously")}</label>
          </div>
        )}
      </form>
    </div>
  );
};

export const Composer = ({ circleId, onPosted }: { circleId: number; onPosted: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [kind, setKind] = useState<PostKind>("alert");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api(`/api/circles/${circleId}/posts`, { body: { kind, body: body.trim(), anonymous } });
      setBody("");
      setAnonymous(false);
      toast({ title: t("circles.posted") });
      onPosted();
    } catch (err) {
      toast({ title: t("circles.actionFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-[2rem] bg-card p-5 shadow-card ring-1 ring-border sm:p-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("circles.postKind")}</legend>
        <div className="flex flex-wrap gap-2">
          {POST_KINDS.map((k) => {
            const { icon: Icon } = POST_STYLE[k];
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition-colors",
                  kind === k ? POST_STYLE[k].className : "bg-background text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {t(postKindKey(k))}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor="circle-post" className="sr-only">
          {t("circles.write")}
        </label>
        <Textarea
          id="circle-post"
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t(`circles.placeholder.${kind}` as MessageKey)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Switch id="circle-post-anon" checked={anonymous} onCheckedChange={setAnonymous} />
          <label htmlFor="circle-post-anon">
            <span className="font-semibold">{t("circles.anonymously")}</span>
            <span className="block text-muted-foreground">{t("circles.anonymousHint")}</span>
          </label>
        </div>
        <Button type="submit" variant="hero" className="gap-2" disabled={sending || body.trim().length < 3}>
          <Send className="h-4 w-4" /> {t("circles.post")}
        </Button>
      </div>
    </form>
  );
};

const Feed = ({ circleId, posts, canModerate, onChange }: { circleId: number; posts: Post[]; canModerate: boolean; onChange: () => void }) => {
  const { t } = useI18n();
  if (posts.length === 0) return <p className="rounded-3xl bg-muted/60 p-8 text-center text-muted-foreground">{t("circles.noPosts")}</p>;
  return (
    <div className="space-y-4">
      {posts.map((p) => {
        const { icon: Icon, className } = POST_STYLE[p.kind];
        return (
          <article key={p.id} className="space-y-3 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border sm:p-6">
            <header className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1", className)}>
                  <Icon className="h-3.5 w-3.5" /> {t(postKindKey(p.kind))}
                </span>
                <Author item={p} />
              </div>
              <ItemMenu circleId={circleId} item={p} target="post" canModerate={canModerate} onChange={onChange} />
            </header>
            {p.hidden && <HiddenNote />}
            <p className="whitespace-pre-wrap break-words text-[1.05rem]">{p.body}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" /> {p.comments.length}
            </p>
            <Comments circleId={circleId} post={p} canModerate={canModerate} onChange={onChange} />
          </article>
        );
      })}
    </div>
  );
};

export default Feed;
