// Early theme bootstrap: applies the dark class before the app paints so
// users with a dark preference never see a white flash on load.
// Served as an external file so it satisfies the CSP (script-src 'self').
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch (e) {
    // Ignore storage access failures (e.g. private mode with storage disabled).
  }

  var dark =
    stored === 'dark' ||
    (!stored &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
