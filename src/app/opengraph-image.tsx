import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Stud-Bud — find a room worth studying in";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #04191b 0%, #0b3b3a 60%, #7c2d12 100%)",
          color: "#dff3ef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 8, color: "#fb923c" }}>
          HACKMIT · ARDUINO + ROBOT DOG
        </div>
        <div style={{ fontSize: 132, fontWeight: 800, marginTop: 16 }}>Stud-Bud</div>
        <div style={{ fontSize: 44, marginTop: 8, opacity: 0.8 }}>
          Noise, air, light and free seats — scored so you know where to study.
        </div>
      </div>
    ),
    size,
  );
}
