// Estado de carga de Next mientras esta ruta se prepara. Sin esto, cambiar de
// pantalla dejaba la anterior congelada sin senal de que algo estaba pasando.
import { EsqueletoDetalle } from "@/components/ui";

export default function Cargando() {
  return <EsqueletoDetalle />;
}
