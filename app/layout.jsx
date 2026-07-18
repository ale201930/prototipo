import "./globals.css";
import GlobalToast from "./lib/GlobalToast";
import ThemeToggle from "./lib/ThemeToggle";
import PresentationReturn from "./lib/PresentationReturn";
import Script from "next/script";

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
    <html lang="es" className="antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/img/logo-pwa-192.png" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <Script id="theme-loader" strategy="beforeInteractive">
          {`
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('theme-dark', 'dark');
              } else {
                document.documentElement.classList.remove('theme-dark', 'dark');
              }
            } catch (e) {}
          `}
        </Script>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(reg) {
                  console.log('Service Worker registrado con éxito:', reg.scope);
                }, function(err) {
                  console.log('Error al registrar el Service Worker:', err);
                });
              });
            }
          `}
        </Script>
      </head>
      <body className="m-0 p-0 min-h-screen overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-900" style={{ fontFamily: "'Inter', sans-serif" }} suppressHydrationWarning>
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow w-full">
            {children}
          </main>
        </div>
        <GlobalToast />
        <ThemeToggle />
        <PresentationReturn />
      </body>
    </html>
  );
}
