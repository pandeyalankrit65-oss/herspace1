import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Opens every new page at the top (or at its #anchor), like a normal website. Back and
// forward keep the browser's own scroll restoration.
const ScrollManager = () => {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === "POP") return;
    if (hash) {
      // Pages are lazy-loaded: wait a moment for the target to exist.
      let tries = 0;
      const find = () => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) el.scrollIntoView({ block: "start" });
        else if (tries++ < 20) window.setTimeout(find, 50);
      };
      find();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navType]);

  return null;
};

export default ScrollManager;
