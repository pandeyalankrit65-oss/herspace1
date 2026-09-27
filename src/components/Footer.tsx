import { Shield, Phone, MapPin } from "lucide-react";
import { EMERGENCY_NUMBER } from "@/lib/api";
import { useI18n } from "@/i18n";
import { Link } from "react-router-dom";

const Footer = () => {
  const { t } = useI18n();
  return (
    <footer className="bg-card border-t border-border/50 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-primary to-accent p-2 rounded-lg">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                HerSpace
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">{t("footer.quickLinks")}</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/sos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("nav.sos")}
                </Link>
              </li>
              <li>
                <Link to="/report" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("footer.reportIncident")}
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("nav.support")}
                </Link>
              </li>
              <li>
                <Link to="/corporate" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("nav.corporate")}
                </Link>
              </li>
              <li>
                <Link to="/circles" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("footer.circles")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">{t("footer.contact")}</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>
                  {t("footer.emergency")} <a href={`tel:${EMERGENCY_NUMBER}`} className="text-primary hover:underline">{EMERGENCY_NUMBER}</a>
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <Link to="/map" className="hover:text-primary transition-colors">{t("nav.map")}</Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">{t("footer.legal")}</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/account" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t("footer.yourData")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/50 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">HerSpace</span> — {t("footer.mission")}
          </p>
          <p className="text-sm text-muted-foreground">{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <p className="text-sm text-muted-foreground">{t("footer.madeBy")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
