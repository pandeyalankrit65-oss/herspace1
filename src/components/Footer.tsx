import { Shield, Phone, MapPin, Twitter, Instagram, Linkedin } from "lucide-react";
import { EMERGENCY_NUMBER } from "@/lib/api";
import { Link } from "react-router-dom";

const Footer = () => {
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
              Empowering women through safety, support, and community.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/sos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Safety Alert
                </Link>
              </li>
              <li>
                <Link to="/report" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Report Incident
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  AI Support
                </Link>
              </li>
              <li>
                <Link to="/corporate" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Corporate Connect
                </Link>
              </li>
              <li>
                <Link to="/circles" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Safe Circles
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>
                  Emergency: <a href={`tel:${EMERGENCY_NUMBER}`} className="text-primary hover:underline">{EMERGENCY_NUMBER}</a>
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <Link to="/map" className="hover:text-primary transition-colors">Safe Map</Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Follow Us</h3>
            <div className="flex gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary hover:bg-primary hover:shadow-[var(--glow-primary)] transition-all"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary hover:bg-primary hover:shadow-[var(--glow-primary)] transition-all"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary hover:bg-primary hover:shadow-[var(--glow-primary)] transition-all"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/50 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">HerSpace</span> — Building a Safer Digital World for Women
          </p>
          <p className="text-sm text-muted-foreground">
            © 2025 HerSpace. All rights reserved. |{" "}
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>{" "}
            |{" "}
            <a href="#" className="hover:text-primary transition-colors">
              Terms of Service
            </a>{" "}
            |{" "}
            <a href="#" className="hover:text-primary transition-colors">
              Contact Us
            </a>
          </p>
          <p className="text-sm text-muted-foreground">Made by Sistla and Alan with love</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
