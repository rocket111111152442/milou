import { ImageResponse } from "next/og";

export const alt = "Empreinte de Violettes — Artisane fleuriste à Six-Fours-les-Plages";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Police Google au format TTF (le moteur d'image ne lit pas le WOFF2). Sans réseau : police par défaut. */
async function font(family: string, style = "") {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}${style}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Image de partage : l'étiquette noire à dorure posée sur le papier, comme la carte de visite. */
export default async function OpengraphImage() {
  const [display, text] = await Promise.all([font("Fraunces"), font("Newsreader", ":ital@1")]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, style: "normal" as const, weight: 400 as const }] : []),
    ...(text ? [{ name: "Text", data: text, style: "italic" as const, weight: 400 as const }] : []),
  ];
  const gold = "linear-gradient(100deg, #B9AFA6 0%, #E9E2DA 25%, #FBF8F4 45%, #D3CAC1 65%, #F1EBE4 85%, #C2B8AE 100%)";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#e6dce1", fontFamily: "Display" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "54px 64px", background: "#0C0A0D", boxShadow: "0 40px 80px -40px rgba(17,11,21,0.6)", position: "relative" }}>
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, bottom: 10, border: "1px solid rgba(230, 220, 225,0.25)", display: "flex" }} />
          <div style={{ fontSize: 20, letterSpacing: 12, color: "#D9D0C6", textTransform: "uppercase" }}>Maison</div>
          <div style={{ marginTop: 16, fontSize: 48, letterSpacing: 6, whiteSpace: "nowrap", textTransform: "uppercase", backgroundImage: gold, backgroundClip: "text", color: "transparent" }}>Empreinte de Violettes</div>
          <div style={{ marginTop: 22, width: 90, height: 1, background: "#CFC6BC" }} />
          <div style={{ marginTop: 20, fontSize: 17, letterSpacing: 11, color: "#CFC6BC", textTransform: "uppercase" }}>Artisane fleuriste</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 28, fontStyle: "italic", fontFamily: "Text", color: "#3B2E41" }}>Bouquets, plantes et curiosités botaniques · Six-Fours-les-Plages</div>
      </div>
    ),
    { ...size, fonts },
  );
}
