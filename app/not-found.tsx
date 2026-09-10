import Link from "next/link";
import { Compass } from "lucide-react";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="panel px-6 py-10 text-center">
        <Compass size={28} className="mx-auto text-[var(--color-suave)]" />
        <h1 className="mt-3 text-lg font-bold">Esta página no existe</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-suave)]">
          Puede que el enlace esté mal escrito, o que apunte a una vacante o
          conversación que ya eliminaste.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-primario">
            Ir al panel
          </Link>
          <Link href="/vacantes" className="btn">
            Mis postulaciones
          </Link>
          <Link href="/conversaciones" className="btn">
            Conversaciones
          </Link>
        </div>
      </div>
    </div>
  );
}
