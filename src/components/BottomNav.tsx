import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, FileText, Home, LogIn, LogOut, Map, Menu, MessageCircle, Timer, User, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { cn } from "@/lib/utils";
import { MORE_LINKS } from "./Navbar";

const TABS: Array<{ path: string; label: MessageKey; icon: typeof Home }> = [
  { path: "/", label: "nav.home", icon: Home },
  { path: "/timer", label: "nav.timer", icon: Timer },
];
const TABS_RIGHT: Array<{ path: string; label: MessageKey; icon: typeof Home }> = [
  { path: "/report", label: "nav.report", icon: FileText },
];

const SHEET_LINKS: Array<{ path: string; label: MessageKey; icon: typeof Home; auth?: boolean }> = [
  { path: "/map", label: "nav.map", icon: Map },
  { path: "/support", label: "nav.support", icon: MessageCircle },
  { path: "/contacts", label: "nav.emergencyContacts", icon: Users, auth: true },
  { path: "/account", label: "nav.account", icon: User, auth: true },
];

const Tab = ({ path, label, icon: Icon }: { path: string; label: string; icon: typeof Home }) => (
  <NavLink
    to={path}
    end
    className={({ isActive }) =>
      cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )
    }
  >
    <Icon className="h-[22px] w-[22px]" />
    <span className="max-w-full truncate px-1">{label}</span>
  </NavLink>
);

// Phone navigation: the most-used destinations, with SOS always one tap away in the middle.
// Tapping SOS opens the SOS page (with its cancellable countdown), never sends an alert directly.
const BottomNav = () => {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const onSos = location.pathname === "/sos";
  const moreActive =
    SHEET_LINKS.some((l) => l.path === location.pathname) || MORE_LINKS.some((l) => l.path === location.pathname);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <div aria-hidden className="pb-bottom-nav lg:hidden" />
      <nav
        aria-label={t("nav.mainNav")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch">
          {TABS.map((tab) => (
            <Tab key={tab.path} path={tab.path} label={t(tab.label)} icon={tab.icon} />
          ))}
          <div className="flex flex-1 justify-center">
            <Link
              to="/sos"
              aria-label={t("common.emergencySos")}
              aria-current={onSos ? "page" : undefined}
              className={cn(
                "-mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-background bg-destructive text-destructive-foreground shadow-sos",
                onSos && "ring-2 ring-destructive/40",
              )}
            >
              <AlertCircle className="h-6 w-6" />
              <span className="text-[11px] font-extrabold leading-none">SOS</span>
            </Link>
          </div>
          {TABS_RIGHT.map((tab) => (
            <Tab key={tab.path} path={tab.path} label={t(tab.label)} icon={tab.icon} />
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu className="h-[22px] w-[22px]" />
            {t("nav.more")}
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="safe-bottom rounded-t-3xl px-4 pb-6">
          <SheetHeader className="text-left">
            <SheetTitle>{t("nav.more")}</SheetTitle>
          </SheetHeader>
          {user && <p className="mt-1 truncate text-sm text-muted-foreground">{t("nav.signedInAs", { email: user.email })}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SHEET_LINKS.filter((l) => !l.auth || user).map(({ path, label, icon: Icon }) => (
              <button
                key={path}
                type="button"
                onClick={() => go(path)}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left text-sm font-semibold hover:bg-muted"
              >
                <Icon className="h-5 w-5 text-primary" /> {t(label)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {MORE_LINKS.map((l) => (
              <button
                key={l.path}
                type="button"
                onClick={() => go(l.path)}
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                {t(l.label)}
              </button>
            ))}
          </div>
          <div className="mt-5 border-t pt-4">
            {user ? (
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await logout();
                  navigate("/");
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-semibold hover:bg-muted"
              >
                <LogOut className="h-5 w-5" /> {t("nav.logOut")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go("/login")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground"
              >
                <LogIn className="h-5 w-5" /> {t("common.logIn")}
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BottomNav;
