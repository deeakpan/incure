import type { Metadata } from "next";
import { Playfair_Display, Space_Grotesk, Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "InCure - Global Antidote Experiment",
  description: "Real-time, on-chain pandemic strategy game on Ronin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-black" style={{ backgroundColor: '#000000' }}>
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body { background-color: #000000 !important; background: #000000 !important; }
            #__next, #__next > div, #__next > div > div, #__next > div > div > div { background-color: #000000 !important; background: #000000 !important; }
            [data-rk], [data-rk] > div, [data-rk] > div > div, [data-rk] > div > div > div { background-color: #000000 !important; background: #000000 !important; }
          `
        }} />
      </head>
      <body
        className={`${playfairDisplay.variable} ${spaceGrotesk.variable} ${orbitron.variable} ${rajdhani.variable} antialiased bg-black`}
        style={{ backgroundColor: '#000000' }}
      >
        <Providers>
        {children}
        </Providers>
      </body>
    </html>
  );
}
