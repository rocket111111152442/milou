import { ImageResponse } from "next/og";

export const alt = "Empreinte de Violettes — Artisane fleuriste à Six-Fours-les-Plages";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const petal = (r: number) => `M0,0C${r * 0.25},${-r * 0.1} ${r * 0.4},${-r * 0.92} 0,${-r}C${-r * 0.4},${-r * 0.92} ${-r * 0.25},${-r * 0.1} 0,0Z`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, #3A2350 0%, #160C1C 55%, #09060C 100%)",
          color: "#F6F1EA",
          fontFamily: "serif",
        }}
      >
        <svg width="140" height="140" viewBox="-50 -50 100 100">
          <g transform="translate(0,6)" fill="#3A2350" stroke="#D9BC7E" strokeWidth="1.6">
            <path d={petal(40)} transform="rotate(-24)" />
            <path d={petal(40)} transform="rotate(24)" />
            <path d={petal(34)} transform="rotate(-94)" />
            <path d={petal(34)} transform="rotate(94)" />
            <path d={petal(38)} transform="rotate(180)" />
            <circle r="4" fill="#D9BC7E" />
          </g>
        </svg>
        <div style={{ marginTop: 30, fontSize: 22, letterSpacing: 14, color: "#C6A15B", textTransform: "uppercase" }}>Maison</div>
        <div style={{ marginTop: 10, fontSize: 70, letterSpacing: 8, color: "#EAD7A8", textTransform: "uppercase" }}>Empreinte de Violettes</div>
        <div style={{ marginTop: 22, width: 220, height: 1, background: "#C6A15B" }} />
        <div style={{ marginTop: 22, fontSize: 24, letterSpacing: 8, color: "#B9A2CF", textTransform: "uppercase" }}>Artisane fleuriste · Six-Fours-les-Plages</div>
      </div>
    ),
    size,
  );
}
