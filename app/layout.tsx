import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProveedorApp } from "@/lib/contexto";
import Navegacion from "@/components/Navegacion";
import AvisosMotor from "@/components/AvisosMotor";

export const metadata: Metadata = {
  title: "Job Manager",
  description:
    "Analizador y gestor de postulaciones: evalúa vacantes, genera CVs ATS y responde a reclutadores.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <ProveedorApp>
          <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
            <Navegacion />
            <main className="min-w-0 flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pt-8">
              {children}
            </main>
          </div>
          <AvisosMotor />
        </ProveedorApp>
      </body>
    </html>
  );
}
