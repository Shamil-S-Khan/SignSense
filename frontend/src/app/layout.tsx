import type { Metadata } from "next";
import { Orbitron, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SignSense — Learn ASL",
  description: "Master American Sign Language with real-time webcam feedback, gamified lessons, and XP progression.",
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${orbitron.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a1d27",
              border: "1px solid #22263a",
              color: "#f0f2f8",
              borderRadius: "12px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}

