import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * New route → start at the top. If the URL has a #hash (e.g. /plans#finder), wait for the
 * lazily loaded page to render that element, then bring it into view instead.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    let frame = 0;
    const deadline = performance.now() + 3000;
    const find = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ block: "start" });
        // Images above the target can still shift it while they load — settle once more
        window.setTimeout(() => el.scrollIntoView({ block: "start" }), 450);
      }
      else if (performance.now() < deadline) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
