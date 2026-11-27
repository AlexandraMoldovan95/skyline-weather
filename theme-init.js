// Runs in <head>, before the page is drawn, so the page never flashes in the wrong theme:
// the visitor's saved choice from the theme button, or on a first visit the system's dark/light
// setting. A separate file, not an inline script: the CSP in _headers only runs scripts from
// the site itself. pickTheme() comes from logic.js, loaded just before this file.
(function () {
  let saved = null;
  try {
    saved = localStorage.getItem('skyline-theme');
  } catch (e) {
    // Storage blocked (private mode, strict settings): the system setting decides.
  }
  const systemDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', pickTheme(saved, systemDark));
})();
