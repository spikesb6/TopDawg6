import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Property Empire — Real Estate Investing Game",
  description: "Build your real estate empire. Buy, negotiate, renovate, flip and rent properties.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080808",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#080808] text-white antialiased">
        <div className="max-w-md mx-auto min-h-screen relative bg-[#080808]">
          {children}
        </div>
      </body>
    </html>
  );
}
