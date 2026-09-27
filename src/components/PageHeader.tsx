import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// One consistent page heading: an icon badge, a title and an optional lead paragraph.
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
  <header className={cn("mb-8 space-y-3", align === "center" && "text-center")}>
    <span
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-2xl",
        tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
      )}
    >
      <Icon className="h-6 w-6" />
    </span>
    <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
    {subtitle && (
      <p className={cn("max-w-2xl text-base text-muted-foreground md:text-lg", align === "center" && "mx-auto")}>{subtitle}</p>
    )}
    {children}
  </header>
);

export default PageHeader;
