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
          background: "linear-gradient(135deg, #0d9488 0%, #2dd4bf 55%, #ea580c 100%)",
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
