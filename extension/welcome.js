// Welcome tab: one button. Open the limitations section when linked to #limits (on load or on hash change).
const limits = document.getElementById('limits');
function route() {
  if (location.hash === '#limits') { limits.open = true; limits.querySelector('summary').focus(); return true; }
  return false;
}
if (!route()) document.getElementById('got').focus();
addEventListener('hashchange', route);
document.getElementById('got').addEventListener('click', () => window.close());
