// Self-hosted Noto Sans Ethiopic (SIL Open Font License 1.1).
//
// The font files sit next to fidel.js (in fonts/), so we work out their URL
// from where fidel.js was loaded. No font CDN is used. Browsers only download
// a font when text actually needs it, so English-only users pay nothing.

export function registerEthiopicFont(scriptUrl) {
  if (!scriptUrl || document.getElementById('fidel-fonts')) return;
  const url = (file) => new URL(`fonts/${file}`, scriptUrl).href;
  const style = document.createElement('style');
  style.id = 'fidel-fonts';
  style.textContent = [400, 700]
    .map(
      (weight) => `@font-face {
  font-family: "Fidel Noto Sans Ethiopic";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${url(`noto-sans-ethiopic-${weight}.woff2`)}") format("woff2");
  unicode-range: U+1200-139F, U+2D80-2DDF, U+AB00-AB2F, U+1E7E0-1E7FF;
}`
    )
    .join('\n');
  document.head.append(style);
}
