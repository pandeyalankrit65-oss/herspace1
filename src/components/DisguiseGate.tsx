import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Calculator from "@/components/Calculator";
import { useDisguise } from "@/lib/disguise";

// Shows the calculator instead of the app while disguised mode is locked. Links meant for
// contacts (live tracking, invites) still open normally.
const DisguiseGate = ({ children }: { children: ReactNode }) => {
  const { settings, locked, unlock } = useDisguise();
  const { pathname } = useLocation();
  const forContacts = /^\/(track|confirm-contact)\//.test(pathname);
  if (locked && settings && !forContacts) return <Calculator settings={settings} onUnlock={unlock} />;
  return <>{children}</>;
};

export default DisguiseGate;
