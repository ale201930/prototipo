import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "INVECEM â€” Sistema de GestiÃ³n de Planta",
  description: "Panel de control corporativo para gestiÃ³n de asistencia, personal y contratas de INVECEM.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`}>
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
      </body>
    </html>
  );
}
