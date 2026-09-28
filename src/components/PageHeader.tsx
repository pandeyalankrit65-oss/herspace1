import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// One consistent page heading: an icon badge beside the title, and an optional lead paragraph.
// Kept compact so the page's main action is visible without scrolling on phones.
const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
  align = "left",
  children,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: "primary" | "danger";
  align?: "left" | "center";
  children?: ReactNode;
}) => (
  <header className={cn("mb-6 space-y-2 md:mb-8 md:space-y-3", align === "center" && "text-center")}>
    <div className={cn("flex items-center gap-3", align === "center" && "justify-center")}>
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12 md:rounded-2xl",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-5 w-5 md:h-6 md:w-6" />
      </span>
      <h1 className="text-2xl font-extrabold sm:text-3xl md:text-4xl">{title}</h1>
    </div>
    {subtitle && (
      <p className={cn("max-w-2xl text-sm text-muted-foreground sm:text-base md:text-lg", align === "center" && "mx-auto")}>{subtitle}</p>
    )}
    {children}
  </header>
);

export default PageHeader;
