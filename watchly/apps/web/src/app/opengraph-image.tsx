import { ImageResponse } from "next/og";

export const alt = "Watchly — Ne cherchez plus. Watchly le fait pour vous.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#111118", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 34, height: 8, borderRadius: 8, background: "linear-gradient(90deg, #00E5FF, #245BFF, #8028FF, #ED4DF5)" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#111118" }}>Watchly</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#111118", lineHeight: 1.05, letterSpacing: -2 }}>
            Ne cherchez plus. Watchly le fait pour vous.
          </div>
          <div style={{ fontSize: 30, color: "#6B6B79" }}>Prix, stocks, annonces, nouveautés et disponibilité de vos sites.</div>
        </div>
        <div style={{ height: 10, borderRadius: 10, background: "linear-gradient(90deg, #00E5FF, #245BFF, #8028FF, #ED4DF5)" }} />
      </div>
    ),
    size,
  );
}
