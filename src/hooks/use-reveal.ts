import { useEffect, useRef } from "react";

// Marks `.reveal` elements inside the returned ref as visible once they scroll into view,
// so they fade up (see index.css). Without IntersectionObserver everything shows at once.
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".reveal:not([data-visible])"));
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.setAttribute("data-visible", ""));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });
  return ref;
}
