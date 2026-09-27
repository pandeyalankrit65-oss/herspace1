import { Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate("/");
  };

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/sos", label: "Safety Alert" },
    { path: "/report", label: "Report" },
    { path: "/support", label: "AI Support" },
    { path: "/map", label: "Safe Map" },
    { path: "/corporate", label: "Corporate Connect" },
    { path: "/circles", label: "Circles" },
    { path: "/about", label: "About Us" },
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
                    Contacts
                  </Button>
                </Link>
                <Link to="/account">
                  <Button variant="ghost" className={location.pathname === "/account" ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                    Account
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleLogout} title={`Signed in as ${user.email}`}>
                  Log out
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="hero">Log in</Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </Button>
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
                    Emergency Contacts
                  </Button>
                </Link>
                <Link to="/account" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                    Account
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                  Log out ({user.name})
                </Button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="hero" className="w-full">Log in</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
