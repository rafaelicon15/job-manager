"use client";

// Última red de seguridad: se usa cuando falla el propio layout, así que no
// puede apoyarse en él y tiene que traer su propio <html> y <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b0f17",
          color: "#e6edf7",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>
            La aplicación no pudo arrancar
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#93a3bd", margin: 0 }}>
            Tus vacantes y tu perfil siguen guardados en este navegador. Recarga
            para volver a intentarlo.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #24304a",
              background: "#0e131e",
              color: "#93a3bd",
              fontSize: 11,
              textAlign: "left",
              overflow: "auto",
              maxHeight: 160,
            }}
          >
            {error.message}
          </pre>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "9px 16px",
              border: 0,
              borderRadius: 8,
              background: "#4f8cff",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
