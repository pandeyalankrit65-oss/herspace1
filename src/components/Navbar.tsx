import Logo from "@/components/Logo";
import QuickExit from "@/components/QuickExit";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ChevronDown, Languages, LogOut, Monitor, Moon, ShieldCheck, Sun, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeChoice } from "@/contexts/ThemeContext";
import { LANGS, useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { cn } from "@/lib/utils";

export const PRIMARY_LINKS: Array<{ path: string; label: MessageKey }> = [
  { path: "/timer", label: "nav.timer" },
  { path: "/report", label: "nav.report" },
  { path: "/map", label: "nav.map" },
  { path: "/support", label: "nav.support" },
];

export const MORE_LINKS: Array<{ path: string; label: MessageKey }> = [
  { path: "/walk", label: "nav.walk" },
  { path: "/about", label: "nav.about" },
  { path: "/circles", label: "nav.circles" },
  { path: "/corporate", label: "nav.corporate" },
];

const THEME_ICONS: Record<ThemeChoice, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

export const LanguageToggle = () => {
  const { t, lang, setLang } = useI18n();
  const other = lang === "en" ? "hi" : "en";
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => setLang(other)}
      aria-label={t("nav.switchLanguage")}
      lang={other}
    >
      <Languages className="h-4 w-4" />
      {LANGS[other].label}
    </Button>
  );
};

export const ThemeMenu = () => {
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  const Icon = THEME_ICONS[choice];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label={t("theme.label")}>
          <Icon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36 rounded-xl">
        {(["system", "light", "dark"] as ThemeChoice[]).map((c) => {
          const ItemIcon = THEME_ICONS[c];
          return (
            <DropdownMenuItem
              key={c}
              onSelect={() => setChoice(c)}
              className={cn("gap-2", choice === c && "font-semibold text-primary")}
            >
              <ItemIcon className="h-4 w-4" /> {t(`theme.${c}` as MessageKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

// Top bar. On phones it's just the logo and quick settings; navigation lives in BottomNav.
const Navbar = () => {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const moreActive = MORE_LINKS.some((l) => location.pathname === l.path);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center gap-2 px-4">
        <Link to="/" className="mr-2 flex items-center gap-2 rounded-lg" aria-label="HerSpace">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">HerSpace</span>
        </Link>

        <nav aria-label={t("nav.mainNav")} className="hidden lg:flex items-center gap-1">
          <NavLink
            to="/sos"
            className={({ isActive }) =>
              cn(
                "mr-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition-colors",
                isActive
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/15",
              )
            }
          >
            <AlertCircle className="h-4 w-4" /> SOS
          </NavLink>
          {PRIMARY_LINKS.map((l) => (
            <NavLink key={l.path} to={l.path} className={linkClass}>
              {t(l.label)}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className={linkClass({ isActive: moreActive }) + " inline-flex items-center gap-1"}>
              {t("nav.more")} <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl">
              {MORE_LINKS.map((l) => (
                <DropdownMenuItem key={l.path} asChild>
                  <Link to={l.path}>{t(l.label)}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <QuickExit />
          <LanguageToggle />
          <ThemeMenu />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden lg:inline-flex gap-2 px-2" aria-label={t("nav.accountMenu")}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="font-normal">
                  <div className="font-semibold">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="gap-2">
                  <Link to="/contacts">
                    <Users className="h-4 w-4" /> {t("nav.emergencyContacts")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2">
                  <Link to="/account">
                    <User className="h-4 w-4" /> {t("nav.account")}
                  </Link>
                </DropdownMenuItem>
                {user.moderator && (
                  <DropdownMenuItem asChild className="gap-2">
                    <Link to="/moderation">
                      <ShieldCheck className="h-4 w-4" /> {t("nav.moderation")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" /> {t("nav.logOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" className="hidden lg:block">
              <Button variant="hero" size="sm">
                {t("common.logIn")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
