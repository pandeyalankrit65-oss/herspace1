import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

// A join code (workplaces, circles), shown in two groups of four so it's easy to read aloud.
const CodeBox = ({ code, label }: { code: string; label: string }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const pretty = `${code.slice(0, 4)} ${code.slice(4)}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/25">
      <span className="font-mono text-2xl font-bold tracking-[0.2em]" aria-label={label}>
        {pretty}
      </span>
      <Button
        type="button"
        variant="glass"
        size="sm"
        className="gap-2"
        onClick={() =>
          navigator.clipboard.writeText(pretty).then(
            () => toast({ title: t("common.copied") }),
            () => {},
          )
        }
      >
        <Copy className="h-4 w-4" /> {t("common.copy")}
      </Button>
    </div>
  );
};

export default CodeBox;
