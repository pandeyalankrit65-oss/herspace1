import { useEffect } from "react";
import { X } from "lucide-react";
import { quickExit, useDisguise, useQuickExitEnabled } from "@/lib/disguise";
import { useI18n } from "@/i18n";

// Leaves at once: to the calculator in disguised mode, otherwise to an ordinary web page.
// Pressing Esc twice quickly does the same.
const QuickExit = () => {
  const { t } = useI18n();
  const enabled = useQuickExitEnabled();
  const { settings, lock } = useDisguise();
  const show = enabled || Boolean(settings);
  const exit = settings ? lock : quickExit;

  useEffect(() => {
    if (!show) return;
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (Date.now() - last < 800) exit();
      last = Date.now();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, exit]);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={exit}
      className="inline-flex h-9 items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/20"
    >
      <X className="h-4 w-4" /> {t("exit.button")}
    </button>
  );
};

export default QuickExit;
