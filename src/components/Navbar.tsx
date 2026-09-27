import { Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, Menu, X, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LANGS, useI18n } from "@/i18n";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const otherLang = lang === "en" ? "hi" : "en";

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate("/");
  };

  const navItems = [
    { path: "/sos", label: t("nav.sos") },
    { path: "/timer", label: t("nav.timer") },
    { path: "/report", label: t("nav.report") },
    { path: "/support", label: t("nav.support") },
    { path: "/map", label: t("nav.map") },
    { path: "/corporate", label: t("nav.corporate") },
    { path: "/circles", label: t("nav.circles") },
    { path: "/about", label: t("nav.about") },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-primary to-accent p-2 rounded-lg group-hover:shadow-[var(--glow-primary)] transition-all">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              HerSpace
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className={
                    location.pathname === item.path
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }
                >
                  {item.label}
                </Button>
              </Link>
            ))}
            {user ? (
              <>
                <Link to="/contacts">
                  <Button variant="ghost" className={location.pathname === "/contacts" ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                    {t("nav.contacts")}
                  </Button>
                </Link>
                <Link to="/account">
                  <Button variant="ghost" className={location.pathname === "/account" ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                    {t("nav.account")}
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleLogout} title={`Signed in as ${user.email}`}>
                  {t("nav.logOut")}
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="hero">{t("common.logIn")}</Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Always visible, so someone who can't read English can find it. */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setLang(otherLang)}
              aria-label={t("nav.switchLanguage")}
              lang={otherLang}
            >
              <Languages className="h-4 w-4" />
              {LANGS[otherLang].label}
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden pb-4 space-y-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${
                    location.pathname === item.path
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
            {user ? (
              <>
                <Link to="/contacts" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                    {t("nav.emergencyContacts")}
                  </Button>
                </Link>
                <Link to="/account" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                    {t("nav.account")}
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                  {t("nav.logOutAs", { name: user.name })}
                </Button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="hero" className="w-full">{t("common.logIn")}</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
