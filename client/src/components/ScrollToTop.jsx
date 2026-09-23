import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    let observer;
    let timeout;
    let restoreTabIndex;
    let cancelled = false;
    let anchor;
    try { anchor = hash ? decodeURIComponent(hash.slice(1)) : null; } catch { anchor = hash.slice(1); }

    const stopWaiting = () => {
      cancelled = true;
      observer?.disconnect();
      clearTimeout(timeout);
    };
    const focus = (target) => {
      // A delayed anchor must not interrupt somebody already editing a form.
      const active = document.activeElement;
      if (active?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!target.hasAttribute('tabindex') && !target.matches('a[href], button, input, select, textarea')) {
        target.setAttribute('tabindex', '-1');
        restoreTabIndex = () => target.removeAttribute('tabindex');
        target.addEventListener('blur', restoreTabIndex, { once: true });
      }
      target.focus({ preventScroll: true });
    };
    const reachAnchor = () => {
      if (cancelled) return true;
      const target = document.getElementById(anchor);
      if (!target) return false;
      target.scrollIntoView({ behavior: 'instant' });
      focus(target);
      stopWaiting();
      return true;
    };
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      if (anchor) {
        if (!reachAnchor()) {
          observer = new MutationObserver(reachAnchor);
          observer.observe(document.body, { childList: true, subtree: true });
          timeout = setTimeout(stopWaiting, 10_000);
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
        const main = document.getElementById('main-content');
        if (main) focus(main);
      }
    });
    document.addEventListener('pointerdown', stopWaiting, { once: true });
    document.addEventListener('keydown', stopWaiting, { once: true });
    return () => {
      stopWaiting();
      cancelAnimationFrame(frame);
      restoreTabIndex?.();
      document.removeEventListener('pointerdown', stopWaiting);
      document.removeEventListener('keydown', stopWaiting);
    };
    // Query-only filter changes deliberately preserve scroll and form focus.
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
