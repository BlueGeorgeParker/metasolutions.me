// Text drawn as outlines rather than canvas text, so it glides with the shapes while zooming instead of snapping to
// whole pixels. The fonts are map-fonts.js (Source Serif 4 at one optical size, 60, and Source Sans 3, cut to Latin),
// read by opentype.js; load both first. Measuring with width() uses the same fonts, so what is drawn is what was
// measured. If either is missing, window.PathText stays unset and pages fall back to canvas text.
//   PathText.width(text, wt, fam, it)                      width per 1px of font size
//   PathText.fill(ctx, text, x, y, fs, wt, fam, it, dpr, ang)
//       fills `text` in the current fillStyle and globalAlpha with its baseline's left end at canvas px (x, y), at
//       size fs px, turned by ang radians about that point; dpr defaults to the canvas's current scale
// fam may be a name or a CSS font stack; its first family decides: one named serif and not sans (Source Serif 4,
// serif) draws in Source Serif 4 600/700, anything else in Source Sans 3 400/600/700 and italic 400. Each string's
// outline is cached.
(() => {
  if ((window.PathText && window.PathText.rotates) || !window.opentype || !window.MAP_FONTS) return;
  try {
    const parse = b64 => { const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return opentype.parse(buf.buffer); };
    const F = {}; for (const k in MAP_FONTS) F[k] = parse(MAP_FONTS[k]);
    const isSerif = fam => { const first = String(fam).split(',')[0]; return /serif/i.test(first) && !/sans/i.test(first); };
    const pick = (wt, fam, it) => isSerif(fam) ? (wt >= 700 ? F.serif700 : F.serif600)
      : it ? F.sans400i : wt >= 700 ? F.sans700 : wt >= 600 ? F.sans600 : F.sans400;
    const paths = new Map(), widths = new Map();
    const key = (text, wt, fam, it) => `${wt}|${isSerif(fam) ? 's' : 'n'}|${it ? 1 : 0}|${text}`;
    window.PathText = {
      rotates: true,
      width(text, wt, fam, it) {
        const k = key(text, wt, fam, it);
        let w = widths.get(k);
        if (w == null) { w = pick(wt, fam, it).getAdvanceWidth(text, 100, { kerning: true }) / 100; widths.set(k, w); }
        return w;
      },
      fill(c, text, x, y, fs, wt, fam, it, dprNow, ang = 0) {
        const k = key(text, wt, fam, it);
        let path = paths.get(k);
        if (!path) { path = new Path2D(pick(wt, fam, it).getPath(text, 0, 0, 100, { kerning: true }).toPathData(2)); paths.set(k, path); }
        const m = c.getTransform(), d = dprNow || Math.hypot(m.a, m.b), sc = d * fs / 100;
        const co = Math.cos(ang) * sc, si = Math.sin(ang) * sc;
        c.save(); c.setTransform(co, si, -si, co, d * x, d * y); c.fill(path); c.restore();
      },
    };
  } catch (e) { /* fall back to canvas text */ }
})();
