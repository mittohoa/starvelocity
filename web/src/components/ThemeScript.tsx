/**
 * Applies the stored theme before the page paints.
 *
 * Without this, a viewer who chose dark gets a white flash on every navigation:
 * the CSS defaults to light, and React only sets the attribute after hydration.
 * Running synchronously as the first child of <body> closes that window.
 *
 * Stored values are only ever 'dark' or 'light'. "System" is represented by the
 * absence of the attribute, which lets the prefers-color-scheme media query
 * take over.
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
