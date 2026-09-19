import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          background: "linear-gradient(135deg, #f0abfc 0%, #a78bfa 50%, #38bdf8 100%)",
          color: "white",
          fontSize: 38,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
