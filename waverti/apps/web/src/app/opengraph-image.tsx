import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

export const alt = "Waverti — Ne cherchez plus. Waverti le fait pour vous.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const mark = `data:image/png;base64,${(await readFile(new URL("./og-mark.png", import.meta.url))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={mark} width={72} height={72} alt="" />
          <div style={{ fontSize: 40, fontWeight: 700, color: "#111118" }}>Waverti</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#111118", lineHeight: 1.05, letterSpacing: -2 }}>
            Ne cherchez plus. Waverti le fait pour vous.
          </div>
          <div style={{ fontSize: 30, color: "#6B6B79" }}>Prix, stocks, annonces, nouveautés et disponibilité de vos sites.</div>
        </div>
        <div style={{ height: 10, borderRadius: 10, background: "linear-gradient(90deg, #00E5FF, #245BFF, #8028FF, #ED4DF5)" }} />
      </div>
    ),
    size,
  );
}
