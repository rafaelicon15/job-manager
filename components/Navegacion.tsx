"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  LayoutDashboard,
  Radar,
  Settings,
  UserRound,
  MessagesSquare,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "@/lib/contexto";

const ENLACES = [
  { href: "/", label: "Panel", Icono: LayoutDashboard },
  { href: "/buscar", label: "Buscar vacantes", Icono: Radar },
  { href: "/vacantes", label: "Mis postulaciones", Icono: BriefcaseBusiness },
  { href: "/conversaciones", label: "Conversaciones", Icono: Inbox },
  { href: "/asistente", label: "Asistente", Icono: MessagesSquare },
  { href: "/perfil", label: "Perfil maestro", Icono: UserRound },
  { href: "/ajustes", label: "Ajustes", Icono: Settings },
];

export default function Navegacion() {
  const ruta = usePathname();
  const { estado, listo } = useApp();
  const sinClave = listo && !estado.ajustes.geminiApiKey;
  // El nombre sale del perfil de cada quien, no del codigo.
  const nombre = listo ? estado.perfil.nombre : "";
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <nav
      className="sticky top-0 z-30 shrink-0 border-b border-[var(--color-borde)] bg-[var(--color-panel)]/95
        backdrop-blur lg:h-screen lg:w-60 lg:border-b-0 lg:border-r"
    >
      <div className="flex items-center gap-2 px-4 py-4 lg:px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-acento)] text-sm font-bold text-white">
          {iniciales || "JM"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Job Manager</p>
          <p className="truncate text-[11px] text-[var(--color-suave)]">
            {nombre || "Configura tu perfil"}
          </p>
        </div>
      </div>

      <ul className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3">
        {ENLACES.map(({ href, label, Icono }) => {
          const activo = href === "/" ? ruta === "/" : ruta.startsWith(href);
          return (
            <li key={href} className="shrink-0 lg:shrink">
              <Link
                href={href}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  activo
                    ? "bg-[var(--color-acento)]/15 font-semibold text-[var(--color-acento)]"
                    : "text-[var(--color-suave)] hover:bg-[var(--color-panel2)] hover:text-[var(--color-texto)]"
                }`}
              >
                <Icono size={17} strokeWidth={2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {sinClave && (
        <div className="mx-3 mb-3 hidden rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 lg:block">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <AlertTriangle size={14} /> Motor apagado
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-200/80">
            Pega tu API key de Gemini en{" "}
            <Link href="/ajustes" className="underline">
              Ajustes
            </Link>{" "}
            para activar el análisis.
          </p>
        </div>
      )}
    </nav>
  );
}
