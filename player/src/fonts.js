// Self-hosted Poppins and Noto Sans Ethiopic (SIL Open Font License 1.1).
//
// The font files sit next to fidel.js (in fonts/), so we work out their URL
// from where fidel.js was loaded. No font CDN is used. Browsers only download
// a font when text actually needs it.

export function registerFidelFonts(scriptUrl) {
  if (!scriptUrl || document.getElementById('fidel-fonts')) return;
  const url = (file) => new URL(`fonts/${file}`, scriptUrl).href;
  const style = document.createElement('style');
  style.id = 'fidel-fonts';
  const poppins = [400, 500, 600, 700].map(
    (weight) => `@font-face {
  font-family: "Fidel Poppins";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${url(`poppins-${weight}.woff2`)}") format("woff2");
}`
  );
  const ethiopic = [400, 700].map(
    (weight) => `@font-face {
  font-family: "Fidel Noto Sans Ethiopic";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${url(`noto-sans-ethiopic-${weight}.woff2`)}") format("woff2");
  unicode-range: U+1200-139F, U+2D80-2DDF, U+AB00-AB2F, U+1E7E0-1E7FF;
}`
  );
  style.textContent = [...poppins, ...ethiopic].join('\n');
  document.head.append(style);
}
