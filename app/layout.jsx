import { Inter } from "next/font/google";
import "./globals.css";
import GlobalToast from "./lib/GlobalToast";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "INVECEM — Sistema de Gestión de Planta",
  description: "Panel de control corporativo para gestión de asistencia, personal y contratas de INVECEM.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`} data-scroll-behavior="smooth">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="m-0 p-0 min-h-screen overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-900" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow w-full">
            {children}
          </main>
        </div>
        <GlobalToast />
      </body>
    </html>
  );
}
