import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const description =
  "Live temperature, humidity, noise, light and seat data from an Arduino and robot dog, turned into a study-or-not verdict.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.STUDBUD_BASE_URL ?? "http://localhost:3000"),
  title: "Stud-Bud — is this room worth studying in?",
  description,
  openGraph: {
    title: "Stud-Bud — is this room worth studying in?",
    description,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d9488",
};

// Applied before first paint so the page never flashes the wrong theme, or a
// background animation a low-WiFi visitor asked not to have.
const bootScript = `(() => {
  try {
    const stored = localStorage.getItem("studbud-theme");
    const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    const lite = localStorage.getItem("studbud-lite");
    document.documentElement.classList.toggle(
      "lite",
      lite ? lite === "1" : navigator.connection ? navigator.connection.saveData === true : false,
    );
  } catch {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="blueprint" aria-hidden="true">
          <span />
        </div>
        {children}
      </body>
    </html>
  );
}
