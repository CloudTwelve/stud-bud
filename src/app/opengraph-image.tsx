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
          background: "linear-gradient(135deg, #fdf2ff 0%, #e0e7ff 45%, #ccfbf1 100%)",
          color: "#3b0764",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 8, opacity: 0.6 }}>
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
