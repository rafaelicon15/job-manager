import type {
  Adjunto,
  Analisis,
  Idioma,
  PerfilMaestro,
  Reunion,
  Vacante,
} from "./types";
import { TIPOS_REUNION } from "./types";

/**
 * Serializa el perfil maestro a un bloque compacto que el modelo pueda citar.
 * Cada logro lleva su id: el modelo está obligado a devolver el id de origen
 * de cada afirmación, y la app verifica que ese id exista de verdad.
 */
export function perfilComoTexto(p: PerfilMaestro): string {
  const exp = p.experiencias
    .map((e) => {
      const periodo = [e.desde, e.hasta].filter(Boolean).join(" – ") || "(fechas sin definir)";
      const logros = e.logros
        .map(
          (l) =>
            `    - [${l.id}] ${l.texto}${l.metrica ? ` (MÉTRICA VERIFICADA: ${l.metrica})` : ""} | ángulos: ${l.angulos.join(", ")} | keywords: ${l.keywords.join(", ")}`
        )
        .join("\n");
      return `  * ${e.puesto} — ${e.empresa} (${e.ubicacion}, ${e.modalidad}) [${periodo}]\n${logros}`;
    })
    .join("\n");

  const skills = p.habilidades
    .map(
      (g) =>
        `  * ${g.categoria}: ${g.items
          .map(
            (i) =>
              `${i.nombre} (nivel ${i.nivel}/4${i.anios ? `, ${i.anios} años` : ""})`
          )
          .join("; ")}`
    )
    .join("\n");

  const certs = p.certificaciones
    .map((c) => `  * ${c.nombre} — ${c.emisor}`)
    .join("\n");

  const psico = p.psicometria
    .map(
      (r) =>
        `  * ${r.titulo} (${r.etiquetas.join(", ")}): ${r.implicaciones.join("; ")}`
    )
    .join("\n");

  return `
IDENTIDAD
  Nombre: ${p.nombre}
  Titular actual (ES): ${p.titular}
  Titular actual (EN): ${p.titularEn}
  Email: ${p.email} | Teléfono: ${p.telefono} | Ubicación: ${p.ubicacion}
  Enlaces: ${p.links.map((l) => `${l.etiqueta}: ${l.url}`).join(" | ")}

RESUMEN (ES): ${p.resumen}
RESUMEN (EN): ${p.resumenEn}

EXPERIENCIA (única fuente de verdad; cada logro tiene un id entre corchetes)
${exp}

EDUCACIÓN
${p.educacion.map((e) => `  * ${e.titulo} — ${e.institucion} — ESTADO: ${e.estado}`).join("\n")}

CERTIFICACIONES
${certs}

HABILIDADES (nivel 1=nociones, 2=funcional, 3=sólido, 4=experto)
${skills}

IDIOMAS
${p.idiomas.map((i) => `  * ${i.idioma}: ${i.nivel}`).join("\n")}

PERFIL PSICOMÉTRICO (informe Wonderlic Select, resultado real de un test)
${psico}

PREFERENCIAS
  Modalidad: ${p.preferencias.modalidad}
  Disponibilidad: ${p.preferencias.disponibilidad}
  Salario mínimo: ${p.preferencias.salarioMin || "sin definir"}
  Salario objetivo: ${p.preferencias.salarioObjetivo || "sin definir"}
  Roles objetivo: ${p.preferencias.rolesObjetivo.join(", ")}
`.trim();
}

/** Reglas que aplican a TODA generación. Esto es lo que evita que te quemes. */
export function reglasDeHonestidad(p: PerfilMaestro): string {
  return `
REGLAS INVIOLABLES
${p.lineasRojas.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Cómo persuadir sin mentir:
  - Puedes reencuadrar, priorizar y reordenar hechos reales para que encajen con la vacante.
  - Puedes traducir una tarea al vocabulario del sector de la empresa.
  - Puedes inferir una capacidad adyacente SOLO si la marcas como transferible y nombras el hecho real que la sostiene.
  - NO puedes convertir "nivel 2/4" en "experto", ni "2 años" en "5 años", ni una herramienta parecida en la herramienta pedida.
  - Ante la duda entre sonar impresionante y ser exacto, elige ser exacto.
`.trim();
}

export function promptParsearVacante(textoCrudo: string): string {
  return `Eres un extractor de datos. Recibes el texto crudo de una oferta de empleo (puede venir sucio, con menús, cookies y basura de la web).

Devuelve SOLO los datos de la oferta. Si un campo no aparece en el texto, devuelve cadena vacía; NO lo inventes.
En "descripcion" reconstruye la oferta limpia y completa: misión del puesto, responsabilidades, requisitos obligatorios, requisitos deseables, condiciones y beneficios. Conserva el idioma original de la oferta.

TEXTO CRUDO:
"""
${textoCrudo.slice(0, 60000)}
"""`;
}

/**
 * Cómo debe SONAR todo lo que escribe el motor. Separado de las reglas de
 * honestidad porque son cosas distintas: aquellas evitan que mienta, estas
 * evitan que suene a texto generado por una máquina.
 *
 * Los guiones largos son el caso más delatador. Un modelo los usa para meter
 * aclaraciones a mitad de frase y el resultado se reconoce a distancia; una
 * persona escribiendo por chat pone una coma o parte la frase en dos.
 */
export function reglasDeEstilo(): string {
  return `
CÓMO ESCRIBIR
  - NO uses guiones largos (—) ni guiones para meter aclaraciones dentro de una
    frase. Usa comas, paréntesis, o parte la frase en dos. Esto aplica también a
    los guiones cortos usados como separadores de ideas.
  - Nada de superlativos vacíos: "encaja perfectamente", "soy el candidato
    ideal", "me apasiona", "experiencia extensa". Di lo que encaja y por qué.
    "Se alinea con" en lugar de "encaja perfectamente".
  - Nada de relleno de cortesía: "quedo atento a tus comentarios", "no dudes en
    contactarme", "agradezco de antemano". Si hay que cerrar, un "quedo atento"
    basta.
  - Frases cortas. Si una frase pasa de 25 palabras, pártela.
  - No enumeres tres herramientas cuando una demuestra lo mismo.
  - Escribe como habla alguien que sabe de lo que habla: concreto y sin adornos.
`.trim();
}

export function promptAnalizar(p: PerfilMaestro, v: Vacante): string {
  return `Eres un reclutador técnico veterano y a la vez el agente de carrera de ${p.nombre}. Tu trabajo es decirle la verdad, no darle ánimos.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

VACANTE A EVALUAR
  Puesto: ${v.titulo}
  Empresa: ${v.empresa}
  Ubicación: ${v.ubicacion} | Modalidad: ${v.modalidad} | Salario: ${v.salario || "no publicado"}
  Fuente: ${v.fuente}
  Descripción:
  """
  ${v.descripcion.slice(0, 30000)}
  """

Analiza el encaje real y devuelve el JSON pedido. Instrucciones por campo:

- puntaje: 0-100. Sé severo. 90+ solo si cumple prácticamente todo lo obligatorio. Si falta un requisito excluyente (título exigido por ley, idioma que no tiene, años de experiencia en una herramienta concreta que no domina, presencialidad en otro país), el puntaje NO puede pasar de 45.
- veredicto: "aplicar_ya" (encaje fuerte, prioridad alta), "aplicar" (buen encaje, vale el esfuerzo), "dudoso" (tiro largo, solo si hay pocas opciones), "no_aplicar" (pierde el tiempo).
- razonVeredicto: 2-3 frases directas. Sin adornos.
- anguloRecomendado: qué perfil vender aquí. Uno de: "CRO y Conversión", "Automatización con IA", "Paid Media / PPC", "SEO", "Desarrollo Web / E-commerce", "Soporte TI e Infraestructura", o una combinación de dos.
- titularSugerido: el titular del CV para ESTA vacante, en el idioma de la oferta. Máx. 110 caracteres.
- requisitos: TODOS los requisitos detectables. Para cada uno di si está cubierto ("si" | "parcial" | "no"), con qué hecho concreto del perfil (cita el id del logro o la habilidad y su nivel), y cómo responder si el reclutador pregunta por él.
- fortalezas: 3-5 puntos donde es claramente más fuerte que el candidato promedio a esta vacante.
- brechas: cada carencia real con una mitigación honesta y accionable.
- keywordsATS: 12-20 términos literales de la oferta que el CV debe contener y que el perfil respalda de verdad. No incluyas keywords que obligarían a mentir.
- banderasRojas: señales de alarma de la propia oferta (salario ausente y sospechoso, "familia", pago en comisiones, requisitos absurdos para el nivel, empresa sin rastro, ofertas que huelen a estafa). Si no hay, devuelve lista vacía.
- preguntasParaElReclutador: 3-4 preguntas inteligentes que lo posicionen como profesional serio.

Responde en español, salvo titularSugerido que va en el idioma de la oferta.`;
}

export function promptCV(
  p: PerfilMaestro,
  v: Vacante,
  a: Analisis | undefined,
  idioma: Idioma
): string {
  const lang = idioma === "en" ? "inglés" : "español";
  return `Eres un redactor de CVs especializado en superar filtros ATS (Applicant Tracking Systems) sin recurrir a trucos ni a mentiras.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

VACANTE OBJETIVO
  Puesto: ${v.titulo} — ${v.empresa}
  Descripción:
  """
  ${v.descripcion.slice(0, 30000)}
  """

${a ? `ANÁLISIS PREVIO\n  Ángulo a vender: ${a.anguloRecomendado}\n  Titular sugerido: ${a.titularSugerido}\n  Keywords ATS obligatorias: ${a.keywordsATS.join(", ")}\n  Fortalezas a destacar: ${a.fortalezas.join(" | ")}` : ""}

Construye el CV en ${lang}. Reglas de redacción:

1. Cada bullet empieza con un verbo de acción en pasado (o presente si el puesto es actual) y termina en un resultado o en el "para qué".
2. Integra las keywords ATS de forma natural dentro de los bullets. Nada de listas de keywords sueltas ni texto oculto.
3. Reordena y reescribe los logros para que los más relevantes a ESTA vacante vayan primero, dentro de cada experiencia y entre experiencias.
4. Puedes fusionar dos logros del perfil en un bullet, o partir uno en dos, pero el contenido factual debe salir del perfil.
5. Cada bullet debe declarar en "origen" el id (o los ids) del logro del perfil de donde sale. Si un bullet es puramente de contexto y no sale de un logro, pon "perfil".
6. Longitud: máximo 6 bullets en la experiencia más relevante, 2-4 en las demás. Las experiencias de TI antiguas se comprimen a 1-2 bullets salvo que la vacante sea de TI.
7. En "habilidades" incluye solo categorías relevantes a la vacante, con los items ordenados por relevancia. No listes herramientas de nivel 1-2 como si fueran fuertes.
8. En "certificaciones" incluye solo las que aporten a esta vacante (máx. 8).
9. El resumen profesional: 3-4 líneas, en primera persona implícita, cargado de las keywords principales, terminando en la propuesta de valor para esta empresa concreta.
10. "periodo" de cada experiencia: usa exactamente las fechas del perfil. Si están vacías, escribe "" y NO inventes fechas.
11. En "avisos" lista cualquier cosa que ${p.nombre} deba completar o verificar a mano antes de enviar (fechas faltantes, nivel de idioma sin definir, una keyword de la oferta que no pudiste incluir por honestidad).`;
}

export function promptRespuesta(
  p: PerfilMaestro,
  v: Vacante,
  pregunta: string,
  idioma: Idioma,
  tono: string,
  extra: string
): string {
  const lang = idioma === "en" ? "inglés" : "español";
  return `Responde EN PRIMERA PERSONA COMO SI FUERAS ${p.nombre}. No hables de él en tercera persona, no digas "el candidato". Eres él escribiendo.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

CONTEXTO DE LA VACANTE
  Puesto: ${v.titulo} — ${v.empresa}
  Modalidad: ${v.modalidad} | Ubicación: ${v.ubicacion}
  Descripción:
  """
  ${v.descripcion.slice(0, 20000)}
  """
${v.analisis ? `  Ángulo a vender: ${v.analisis.anguloRecomendado}\n  Brechas conocidas: ${v.analisis.brechas.map((b) => b.brecha).join("; ")}` : ""}

PREGUNTA DEL RECLUTADOR O DEL FORMULARIO:
"""
${pregunta}
"""
${extra ? `\nCONTEXTO ADICIONAL QUE APORTA EL CANDIDATO:\n"""\n${extra}\n"""` : ""}

Cómo debes sonar (basado en su perfil Wonderlic real): directo y al grano, seguro sin arrogancia, persuasivo, orientado a resultados y a rentabilidad. Nada de relleno corporativo ni de "soy un apasionado de".

Reglas de la respuesta:
- Idioma: ${lang}.
- Tono: ${tono}.
- Longitud: la mínima que responda bien. Si es una pregunta de formulario, 2-5 frases. Si es una pregunta abierta de entrevista, usa estructura situación-acción-resultado sin nombrar el método.
- Apóyate en hechos concretos del perfil. Nombra herramientas, métricas y empresas reales.
- Si la pregunta toca una brecha real, reconócela en una frase corta y pivota de inmediato a lo que sí tiene y a cómo lo cubriría. No la escondas.
- Si la pregunta pide un dato que no está en el perfil (salario exacto, nivel de inglés, fechas), NO lo inventes: usa un marcador tipo [COMPLETAR: expectativa salarial] y menciónalo en "avisos".
- Devuelve además 2 variantes más cortas por si el formulario tiene límite de caracteres.`;
}

export function promptTriaje(p: PerfilMaestro, lote: { id: string; titulo: string; empresa: string; extracto: string }[]): string {
  return `Eres el filtro de entrada del buscador de empleo de ${p.nombre}. Tienes que descartar rápido y sin piedad.

PERFIL RESUMIDO
  Titular: ${p.titular}
  Roles objetivo: ${p.preferencias.rolesObjetivo.join(", ")}
  Fuerte en: ${p.habilidades.flatMap((g) => g.items.filter((i) => i.nivel >= 3).map((i) => i.nombre)).join(", ")}
  Modalidad requerida: ${p.preferencias.modalidad}
  Idiomas: ${p.idiomas.map((i) => `${i.idioma} (${i.nivel})`).join(", ")}

Para cada vacante del lote devuelve un puntaje 0-100 y un motivo de máximo 12 palabras.
Penaliza duro: puestos presenciales fuera de Venezuela, roles senior de ingeniería de software pura, roles que exigen inglés nativo o un título universitario finalizado, y ofertas fuera de su especialidad.

LOTE:
${lote.map((j) => `[${j.id}] ${j.titulo} — ${j.empresa}\n${j.extracto.slice(0, 900)}`).join("\n\n---\n\n")}`;
}

// ------------------------------------------------------- conversaciones

export function promptParsearConversacion(
  textoCrudo: string,
  canal: string
): string {
  return `Eres un extractor de datos. Recibes una conversación con un reclutador copiada en bruto desde ${canal}. Puede venir sucia: marcas de tiempo, enlaces de perfil, "ha enviado el siguiente mensaje a las 11:05", firmas, avisos de la plataforma.

Tu trabajo es reconstruir el hilo:

1. Identifica quién es el reclutador (nombre, cargo y empresa si aparecen) y su handle (URL de LinkedIn, correo o teléfono, según el canal).
2. Separa la conversación en mensajes individuales, en ORDEN CRONOLÓGICO (el más antiguo primero).
3. Para cada mensaje marca "de": "ellos" si lo escribió el reclutador, "yo" si lo escribió el candidato. El candidato es la persona que se postula; el reclutador es quien ofrece el puesto.
4. En "fecha" copia el sello temporal tal como aparece ("3:58", "Hoy 11:05", "17:23"). Si no hay, deja cadena vacía. NO inventes fechas.
5. Limpia cada mensaje: quita marcas de la plataforma y enlaces rotos, pero NO resumas ni reescribas el contenido. El texto debe quedar tal como se escribió.
6. "asunto": una etiqueta corta que identifique el hilo, del tipo "Growth Specialist — Grupo Index".
7. "contieneOferta": true si en algún mensaje viene descrita una vacante concreta (responsabilidades, requisitos o condiciones). Si es así, rellena "ofertaDetectada" reconstruyendo la oferta completa a partir de lo que dice el reclutador; si no, deja "ofertaDetectada" con cadenas vacías.

CONVERSACIÓN EN BRUTO:
"""
${textoCrudo.slice(0, 60000)}
"""`;
}

/**
 * Redacta la respuesta a un hilo con un reclutador.
 *
 * Las reglas de este prompt salen de correcciones reales sobre respuestas que
 * el motor dio mal, no de suposiciones:
 *  - Saludaba en cada mensaje, incluso con la conversación ya abierta.
 *  - Escribía como un correo formal en un chat de LinkedIn.
 *  - Ofrecía la expectativa salarial por su cuenta, antes de que conviniera.
 *  - Ignoraba el documento adjunto a la ficha, así que había que pegarle a mano
 *    lo que decía.
 *  - Se iba a 500 caracteres cuando 300 concretos funcionaban mejor.
 */
export function promptHilo(
  p: PerfilMaestro,
  canal: string,
  contacto: string,
  hilo: { de: string; texto: string; fecha: string }[],
  vacante: Vacante | undefined,
  instrucciones: string,
  idioma: Idioma,
  tono: string,
  adjuntos: Adjunto[] = []
): string {
  const lang = idioma === "en" ? "inglés" : "español";

  // Si ya ha escrito antes en el hilo, la conversación está abierta y volver a
  // saludar suena a plantilla.
  const conversacionAbierta = hilo.some((m) => m.de === "yo");
  const nombreContacto = contacto.split(/[\s,·|]/)[0] || "el reclutador";

  const limites: Record<string, string> = {
    linkedin:
      'LinkedIn es un CHAT, no un correo. Entre 40 y 80 palabras, nunca más de 600 caracteres. Sin asunto, sin "Estimada", sin despedida de carta, sin firma con tu nombre completo. Un párrafo, o dos cortos como mucho.',
    email:
      'Correo. Rellena el campo "asunto". Saludo, dos o tres párrafos cortos y una despedida breve con tu nombre. Entre 90 y 160 palabras.',
    whatsapp:
      "WhatsApp. Muy breve, entre 25 y 60 palabras. Frases cortas, tono directo, nada corporativo, sin firma.",
    otro: "Formato neutro, breve y profesional. Menos de 120 palabras.",
  };

  const material = adjuntos.filter((a) => a.analisis);

  const bloqueMaterial = material.length
    ? `MATERIAL QUE YA TE HAN MANDADO Y QUE YA HAS LEÍDO
Esto sale de documentos adjuntos a esta ficha. NO preguntes por nada que ya esté
aquí: preguntarlo demuestra que no lo abriste. Al contrario, cita un detalle
concreto de aquí para que se vea que sí lo leíste.
${material
  .map((a) => {
    const an = a.analisis!;
    return [
      `  [${a.nombre}] ${an.titulo}`,
      `  Resumen: ${an.resumen}`,
      `  Puntos clave: ${an.puntosClave.join(" | ")}`,
      an.cifras.length
        ? `  Cifras: ${an.cifras.map((c) => `${c.concepto}: ${c.valor}`).join(" | ")}`
        : "",
      an.encaje ? `  Encaje con el perfil: ${an.encaje}` : "",
      an.huecos.length
        ? `  LO QUE EL DOCUMENTO NO DICE, de aquí salen las preguntas buenas: ${an.huecos.join(" | ")}`
        : "",
      an.alertas.length
        ? `  Alertas: ${an.alertas.map((x) => x.asunto).join(" | ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  })
  .join("\n\n")}`
    : "No hay documentos adjuntos a esta ficha.";

  const reglaSaludo = conversacionAbierta
    ? `LA CONVERSACIÓN YA ESTÁ ABIERTA: ya has escrito antes en este hilo. NO vuelvas a saludar. Nada de "Hola ${nombreContacto}", nada de presentarte, nada de "gracias por contactarme". Entra directo a lo que toca. Como mucho, una fórmula de una palabra si agradeces algo que te acaban de mandar.`
    : "Es tu primer mensaje en este hilo: un saludo corto por el nombre de pila y al asunto.";

  return `Escribes EN PRIMERA PERSONA COMO SI FUERAS ${p.nombre}. Eres él respondiendo por ${canal}. No hables de él en tercera persona.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

${
  vacante
    ? `VACANTE ENLAZADA A ESTE HILO
  Puesto: ${vacante.titulo} en ${vacante.empresa}
  Modalidad: ${vacante.modalidad} | Ubicación: ${vacante.ubicacion} | Salario: ${vacante.salario || "no publicado"}
  Descripción:
  """
  ${vacante.descripcion.slice(0, 18000)}
  """
${
  vacante.analisis
    ? `  Ángulo a vender: ${vacante.analisis.anguloRecomendado}
  Brechas conocidas: ${vacante.analisis.brechas.map((b) => `${b.brecha} -> ${b.mitigacion}`).join(" | ")}
  Banderas rojas detectadas: ${vacante.analisis.banderasRojas.join(" | ") || "ninguna"}`
    : ""
}`
    : "No hay ninguna vacante enlazada a este hilo todavía."
}

${bloqueMaterial}

INTERLOCUTOR: ${contacto}

HILO COMPLETO, del más antiguo al más reciente:
${hilo
  .map(
    (m, i) =>
      `[${i + 1}] ${m.de === "yo" ? p.nombre.split(" ")[0].toUpperCase() : "RECLUTADOR"}${m.fecha ? ` (${m.fecha})` : ""}:\n${m.texto}`
  )
  .join("\n\n")}

${
  instrucciones
    ? `LO QUE EL CANDIDATO QUIERE QUE DIGAS O CONSIGAS EN ESTE MENSAJE:\n"""\n${instrucciones}\n"""\nEsto manda sobre cualquier otra consideración de estilo.`
    : "No hay instrucción específica: responde a lo último que dijo el reclutador y haz avanzar el proceso."
}

Devuelve el JSON pedido. Instrucciones por campo:

- respuesta: el mensaje listo para enviar, en ${lang}, tono ${tono}. ${limites[canal] ?? limites.otro}

  ${reglaSaludo}

  * Responde primero a lo último que te han dicho. Nada de recapitular el hilo.
  * DEMUESTRA QUE LEÍSTE EL MATERIAL. Si hay documentos o descripción del puesto, menciona UN detalle concreto de ellos (el nicho, una herramienta, una cifra, el tipo de cliente) y engánchalo con un hecho real de tu perfil. Un detalle bien elegido convence más que tres frases de entusiasmo.
  * NO OFREZCAS TU EXPECTATIVA SALARIAL por tu cuenta, ni siquiera si te la han pedido, salvo que las instrucciones te digan explícitamente que la des. Dar un número antes de conocer el alcance del trabajo juega en contra. Si te la han pedido, redirige pidiendo primero los datos que faltan para poder dar una cifra con sentido, y anótalo en "avisos" para que lo decida ${p.nombre}.
  * UNA SOLA PETICIÓN CLARA. Máximo dos preguntas, y relacionadas entre sí. Si hay cinco cosas por saber, pregunta las dos que desbloquean el proceso y guarda el resto para el siguiente mensaje.
  * Si el reclutador dejó SIN RESPONDER una pregunta que ${p.nombre} ya hizo antes, vuelve a plantearla una sola vez, con una razón por la que la necesitas.
  * Si te piden algo concreto (enviar CV, confirmar una hora), confírmalo de forma explícita.
  * Si hay que confirmar una cita con hora en otro país, convierte la hora también a la de ${p.nombre} (${p.ubicacion}) para dejar constancia de que no hay malentendido.
  * Si un dato no está en el perfil, usa un marcador [COMPLETAR: …]. NO lo inventes.

- asunto: solo si el canal es "email"; en el resto devuelve cadena vacía.
- variantes: 2 alternativas que cambien de ESTRATEGIA, no solo de tono. Una debe ser claramente más corta que la principal, en torno a la mitad. La otra puede apostar por algo distinto: pedir otro dato, subrayar otro punto del perfil, o cerrar proponiendo una llamada.
- pendientes: lo que el reclutador ha pedido y todavía no consta que se haya hecho. Frases CORTAS que empiecen por verbo, una por tarea. No repitas la misma tarea con otras palabras ni le añadas condiciones del tipo "si lo solicita" o "cuando aclare los detalles": eso convierte la lista en ruido. "Enviar CV actualizado" y nada más.
- preguntasSinResponder: preguntas que EL CANDIDATO hizo en el hilo y que el reclutador aún no ha contestado. Vacío si no hay ninguna.
- incoherencias: ESTA ES LA PARTE MÁS IMPORTANTE. Revisa todo lo que ${p.nombre} afirmó en sus propios mensajes del hilo y compáralo con el PERFIL. Marca cualquier afirmación que el perfil NO respalde: una herramienta que dijo dominar y que no está en Habilidades, un nivel de experiencia inflado, una métrica que no existe en sus logros, un idioma sin declarar. Para cada una: la afirmación literal, por qué es un problema, y cómo reencuadrarla de forma honesta si se lo preguntan. Si todo cuadra con el perfil, devuelve lista vacía. NO inventes incoherencias para rellenar.
- avisos: lo que ${p.nombre} deba decidir o revisar antes de enviar. Incluye SIEMPRE que aplique:
  * Si el reclutador ha pedido la expectativa salarial y no se la has dado, dilo aquí junto al número que figura en el perfil, para que él decida si lo manda.
  * Si el hilo está escrito en un idioma distinto al que has usado para responder, avísalo: contestar en español a quien escribe en inglés se nota.
  * Cualquier dato que hayas dejado como [COMPLETAR: …].`;
}

export function promptCarta(
  p: PerfilMaestro,
  v: Vacante,
  idioma: Idioma,
  tono: string
): string {
  const lang = idioma === "en" ? "inglés" : "español";
  return `Escribes EN PRIMERA PERSONA COMO SI FUERAS ${p.nombre}, no sobre él.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

VACANTE OBJETIVO
  Puesto: ${v.titulo} — ${v.empresa}
  Modalidad: ${v.modalidad} | Ubicación: ${v.ubicacion} | Salario: ${v.salario || "no publicado"}
  Descripción:
  """
  ${v.descripcion.slice(0, 22000)}
  """
${v.analisis ? `\nANÁLISIS PREVIO
  Ángulo a vender: ${v.analisis.anguloRecomendado}
  Fortalezas: ${v.analisis.fortalezas.join(" | ")}
  Brechas: ${v.analisis.brechas.map((b) => `${b.brecha} → ${b.mitigacion}`).join(" | ")}` : ""}

Produce tres piezas en ${lang}, tono ${tono}:

1. asuntoEmail: la línea de asunto del correo. Si la oferta pide un formato de asunto concreto, úsalo EXACTAMENTE. Máx. 80 caracteres.

2. carta: la carta de presentación para el cuerpo del correo. Estructura:
   - Primer párrafo: por qué escribes y el gancho más fuerte que tienes para ESTA empresa. Nada de "me dirijo a ustedes para".
   - Cuerpo: 2 o 3 párrafos cortos, o bien 3-4 viñetas, cada una atando un requisito de la oferta a un hecho concreto y verificable del perfil, con herramientas y cifras reales.
   - Si hay una brecha importante en un requisito visible, decláralo en una frase y pivota a lo que sí tienes. La transparencia proactiva gana credibilidad; que la descubran después la destruye.
   - Cierre: propuesta concreta de siguiente paso y los enlaces de portafolio y LinkedIn.
   - Longitud: 200-320 palabras. Que se lea en un minuto.
   - No repitas el CV línea por línea: la carta explica el "por qué yo para esto", el CV da el detalle.

3. mensajeReclutador: mensaje breve para LinkedIn o InMail dirigido al reclutador, máximo 300 caracteres, que consiga que abra el CV. Directo, sin adulación, con un solo dato que llame la atención.

4. avisos: lista de lo que ${p.nombre} debe completar o revisar antes de enviar (nombre del reclutador si no lo sabes, cualquier dato que hayas dejado como [COMPLETAR: …], cualquier requisito de la oferta que no pudiste cubrir con honestidad).

Nunca inventes el nombre del reclutador ni datos de la empresa que no estén en la descripción. Si no sabes a quién va dirigida, usa un saludo neutro profesional.`;
}

export function promptEntrevista(
  p: PerfilMaestro,
  v: Vacante,
  idioma: Idioma
): string {
  const lang = idioma === "en" ? "inglés" : "español";
  return `Eres el preparador de entrevistas de ${p.nombre}. Tu trabajo NO es darle ánimos: es anticipar exactamente por dónde le van a apretar y darle una respuesta que pueda sostener.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

VACANTE
  Puesto: ${v.titulo} — ${v.empresa}
  Modalidad: ${v.modalidad} | Ubicación: ${v.ubicacion} | Salario: ${v.salario || "no publicado"}
  Descripción:
  """
  ${v.descripcion.slice(0, 22000)}
  """
${v.analisis ? `\nANÁLISIS PREVIO
  Puntaje de encaje: ${v.analisis.puntaje}/100 — ${v.analisis.veredicto}
  Ángulo a vender: ${v.analisis.anguloRecomendado}
  Requisitos NO cubiertos: ${v.analisis.requisitos.filter((r) => r.cubierto === "no").map((r) => r.requisito).join(" | ") || "ninguno"}
  Requisitos parciales: ${v.analisis.requisitos.filter((r) => r.cubierto === "parcial").map((r) => r.requisito).join(" | ") || "ninguno"}
  Brechas: ${v.analisis.brechas.map((b) => `${b.brecha} → ${b.mitigacion}`).join(" | ")}
  Banderas rojas de la oferta: ${v.analisis.banderasRojas.join(" | ") || "ninguna"}` : ""}

${historialReuniones(v.reuniones)}

Prepara la entrevista en ${lang}. Devuelve el JSON pedido:

- estrategia: en 3-4 frases, el hilo conductor que debe mantener durante toda la conversación. Qué es lo único que quiere que recuerden de él al colgar.

- datosAMemorizar: 5-8 datos duros que debe tener en la punta de la lengua: métricas reales de su perfil, herramientas concretas, fechas, nombres de empresas. Solo datos que existan en el perfil.

- preguntas: 6-8 preguntas que con alta probabilidad le van a hacer en ESTA entrevista, ordenadas de más probable a menos. Para cada una:
  * pregunta: tal como la formularía el entrevistador.
  * porQue: qué está evaluando en realidad al preguntar eso.
  * respuesta: la respuesta que debe dar, en primera persona, apoyada en hechos concretos del perfil. Estructura situación-acción-resultado cuando sea de experiencia, sin nombrar el método. 60-140 palabras.
  * evitar: el error concreto que NO debe cometer al responder esa pregunta.

- preguntasIncomodas: las preguntas que le van a doler, y son las más importantes. Cubre obligatoriamente, si aplican al caso: los requisitos que NO cumple, los solapamientos de fechas entre empleos, un título universitario pendiente, un nivel de idioma sin acreditar, una permanencia corta en el puesto actual, por qué se va de su trabajo actual, y la expectativa salarial frente a lo que ofrece la vacante. Para cada una: pregunta, respuesta honesta que no se hunda, y porQueDuele.

- tuTurno: 4-5 preguntas que él debe hacer, que lo posicionen como profesional que evalúa y no como candidato que suplica. Al menos una debe apuntar a las banderas rojas detectadas en la oferta.

- cierre: cómo cerrar la llamada en 2-3 frases, pidiendo el siguiente paso de forma concreta.

- avisos: cualquier cosa que deba decidir o confirmar ANTES de la llamada, incluido cualquier dato que falte en su perfil y que le vayan a preguntar.

Nunca le pongas en la boca una experiencia, herramienta, cifra o titulación que el perfil no respalde. Si un requisito no lo cumple, la respuesta debe reconocerlo y reencuadrarlo, no esquivarlo.`;
}

/**
 * Resume las reuniones que ya han pasado, para que el resto de los prompts no
 * repitan lo ya hablado.
 *
 * Es lo que distingue una segunda entrevista de una primera repetida. Si en la
 * llamada de screening ya dijo que su disponibilidad es inmediata y que le
 * mencionaron un rango, preparar la técnica sin eso delante produce un guion
 * que vuelve a empezar de cero.
 *
 * Solo entran las reuniones ya resumidas: las notas crudas de cuatro llamadas
 * se comen el contexto sin aportar más que su resumen.
 */
export function historialReuniones(reuniones: Reunion[] = []): string {
  const conResumen = reuniones.filter((r) => r.resumen);
  if (!conResumen.length) return "";

  // En orden cronológico, aunque en la pantalla se vean del revés: el modelo
  // tiene que ver cómo ha evolucionado el proceso.
  const orden = [...conResumen].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const etiqueta = (r: Reunion) =>
    TIPOS_REUNION.find((t) => t.id === r.tipo)?.label ?? "Reunión";

  const bloques = orden.map((r) => {
    const x = r.resumen!;
    const partes = [
      `  [${r.fecha || "sin fecha"}] ${etiqueta(r)}${r.canal ? ` por ${r.canal}` : ""}`,
      `  Con: ${r.participantes.map((q) => [q.nombre, q.cargo].filter(Boolean).join(", ")).join(" | ") || "sin registrar"}`,
      `  ${x.resumen}`,
    ];
    if (x.datosDelPuesto.length)
      partes.push(
        `  Condiciones que salieron: ${x.datosDelPuesto.map((d) => `${d.concepto}: ${d.valor}`).join(" | ")}`
      );
    if (x.compromisosMios.length)
      partes.push(`  Prometí yo: ${x.compromisosMios.join(" | ")}`);
    if (x.compromisosDeEllos.length)
      partes.push(`  Prometieron ellos: ${x.compromisosDeEllos.join(" | ")}`);
    if (x.preguntasSinResponder.length)
      partes.push(`  Sigue sin respuesta: ${x.preguntasSinResponder.join(" | ")}`);
    if (x.senalesDeAlerta.length)
      partes.push(`  Señales de alerta: ${x.senalesDeAlerta.join(" | ")}`);
    if (x.aReforzar.length) partes.push(`  A reforzar: ${x.aReforzar.join(" | ")}`);
    return partes.join("\n");
  });

  return `REUNIONES YA CELEBRADAS EN ESTE PROCESO (${orden.length})
${bloques.join("\n\n")}

No vuelvas a plantear lo que ya se resolvió en estas reuniones. Si algo quedó
sin respuesta, eso sí hay que retomarlo.`;
}

/**
 * Convierte los apuntes de una llamada en un resumen utilizable.
 *
 * El acento está en lo que se pierde al colgar: qué prometió cada parte, qué
 * condiciones se mencionaron de pasada, qué pregunta contestó regular y qué
 * dijo que su perfil no respalda. Un resumen bonito de la conversación no
 * sirve de nada; saber que prometió mandar el portafolio el martes, sí.
 */
export function promptReunion(
  p: PerfilMaestro,
  v: Vacante,
  r: Reunion,
  idioma: Idioma
): string {
  const lang = idioma === "en" ? "inglés" : "español";
  const etiqueta = TIPOS_REUNION.find((t) => t.id === r.tipo)?.label ?? "Reunión";
  const gente =
    r.participantes
      .map((q) => [q.nombre, q.cargo].filter(Boolean).join(", "))
      .filter(Boolean)
      .join(" | ") || "no registrados";

  return `Eres el jefe de gabinete de ${p.nombre}. Acaba de salir de una reunión de un proceso de selección y te pasa sus apuntes. Tu trabajo es que no se pierda nada de lo que va a importar dentro de tres semanas.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

VACANTE
  Puesto: ${v.titulo} — ${v.empresa}
  Modalidad: ${v.modalidad} | Ubicación: ${v.ubicacion} | Salario publicado: ${v.salario || "no publicado"}
  Su expectativa: ${p.preferencias.salarioObjetivo || "sin definir"} (mínimo ${p.preferencias.salarioMin || "sin definir"})
${
  v.analisis
    ? `  Requisitos que NO cumple: ${v.analisis.requisitos.filter((q) => q.cubierto === "no").map((q) => q.requisito).join(" | ") || "ninguno"}`
    : ""
}

${historialReuniones((v.reuniones ?? []).filter((x) => x.id !== r.id))}

LA REUNIÓN QUE HAY QUE RESUMIR
  Tipo: ${etiqueta}
  Cuándo: ${r.fecha || "sin fecha"}${r.duracionMin ? ` (${r.duracionMin} min)` : ""}
  Canal: ${r.canal || "sin registrar"}
  Participantes: ${gente}

  APUNTES, TRANSCRIPCIÓN O CHAT, TAL CUAL LOS PEGÓ:
  """
  ${r.notasCrudas.slice(0, 60000)}
  """

Devuelve el JSON pedido, en ${lang}:

- titulo: cómo llamar a esta reunión en cinco palabras o menos.

- resumen: 3 o 4 frases. Qué pasó y en qué quedó.

- puntosClave: lo que de verdad importa, en frases cortas. Entre 3 y 8.

- datosDelPuesto: toda condición concreta que se mencionara, con su concepto y su valor: rango salarial, horario, días de oficina, tipo de contrato, tamaño del equipo, plazos del proceso, quién sería su responsable, herramientas. Cópialas como se dijeron. Si en los apuntes no aparece ninguna, lista vacía. NO rellenes con lo que pone la oferta: aquí solo va lo que salió en la reunión.

- preguntasQueMeHicieron: las preguntas que le hicieron y que aparezcan en los apuntes. Para cada una: "pregunta", "comoRespondi" (lo que contestó según los apuntes, o "no queda claro en los apuntes" si no se sabe) y "mejorRespuesta" (cómo contestarla la próxima vez, apoyada solo en hechos de su perfil, 40-90 palabras). Si contestó bien, dilo en mejorRespuesta y no la cambies por cambiarla.

- compromisosMios: lo que él se comprometió a hacer o mandar, con el plazo si lo dijo. Frases cortas que empiecen por el verbo. Esto es lo primero que se olvida.

- compromisosDeEllos: lo que la empresa se comprometió a hacer, con el plazo si lo dieron.

- preguntasSinResponder: lo que él preguntó y no le contestaron, o le contestaron a medias. Esto es lo que hay que volver a preguntar.

- senalesBuenas: indicios reales de que el proceso va bien. Solo si están en los apuntes. Lista vacía antes que adornar.

- senalesDeAlerta: lo que conviene mirar de cerca. Por ejemplo: el puesto cambió respecto a la oferta, el sueldo que mencionaron está por debajo de su mínimo, no supieron explicar a quién reportaría, el proceso lleva más rondas de las dichas, rotación en el equipo, una prueba técnica larga sin pagar, presión para decidir rápido. Lista vacía si no hay ninguna: no inventes alarmas para rellenar.

- incoherencias: cosas que él dijo en la reunión y su perfil maestro NO respalda, por ejemplo un nivel de idioma, una métrica, una herramienta o una responsabilidad de más. Para cada una: "afirmacion" (lo que dijo), "problema" (por qué no se sostiene) y "comoCorregir" (cómo reencuadrarlo en la siguiente conversación sin desdecirse del todo). Lista vacía si no hay ninguna. Esta es la parte más importante del resumen: lo que se promete en una llamada se cobra en la siguiente.

- aReforzar: qué tiene que preparar para la próxima ronda, a partir de lo que se vio flojo en esta. Entre 2 y 5.

- proximoPaso: el siguiente paso concreto y de quién depende, en una frase. Si en los apuntes no se dijo, escribe qué debería proponer él.

- seguimiento: el mensaje de seguimiento para mandar en las próximas 24 horas, listo para copiar. Entre 60 y 110 palabras. Tiene que citar algo concreto de la reunión, confirmar lo que él prometió y retomar como mucho una pregunta que quedó sin respuesta. Sin volver a presentarse y sin relleno de cortesía.

Trabaja solo con lo que digan los apuntes. Si algo no está, no lo completes con lo que suele pasar en estas reuniones: deja la lista vacía o di que no queda claro. Un resumen que inventa un compromiso es peor que no tener resumen.`;
}

/**
 * Analiza un documento que manda el reclutador. Cubre dos casos muy distintos
 * con el mismo prompt porque el modelo clasifica primero: una descripción de
 * puesto (¿me encaja?) y un contrato o propuesta (¿qué estoy firmando?).
 *
 * El acento está en lo que un candidato con prisa no lee: las cláusulas que
 * atan, y sobre todo lo que el documento NO dice. Un contrato sin fecha de
 * pago o sin causa de terminación no es un contrato incompleto, es un riesgo.
 */
export function promptDocumento(
  p: PerfilMaestro,
  nombreArchivo: string,
  contexto: string,
  textoExtraido?: string
): string {
  return `Eres un asesor de carrera con criterio jurídico básico, revisando un documento que le acaba de llegar a ${p.nombre} de parte de una empresa. Tu trabajo es que entienda qué tiene delante y qué le puede costar caro.

${perfilComoTexto(p)}

${reglasDeHonestidad(p)}

${reglasDeEstilo()}

DOCUMENTO: "${nombreArchivo}"
${contexto ? `CONTEXTO: ${contexto}` : ""}
${textoExtraido ? `\nCONTENIDO:\n"""\n${textoExtraido.slice(0, 60000)}\n"""` : "\nEl documento va adjunto: léelo."}

Devuelve JSON con estas claves:

- clase: una de "descripcion_puesto", "contrato", "propuesta_economica", "prueba_tecnica", "confidencialidad", "otro".
- titulo: cómo llamarías a este documento en cuatro palabras.
- resumen: 2 o 3 frases. Qué es y qué le pide o le ofrece.
- puntosClave: lo que de verdad importa, en frases cortas. Entre 3 y 8.
- cifras: toda cifra concreta que aparezca, con su concepto. Sueldos, plazos de pago, días de vacaciones, horas semanales, penalizaciones, duración, porcentajes. Si no hay ninguna, lista vacía. NO inventes cifras ni las redondees: cópialas como están.
- alertas: cláusulas o condiciones que conviene mirar dos veces ANTES de firmar o aceptar. Para cada una: "asunto" (la cláusula), "porque" (qué riesgo real tiene para él, en concreto, no en abstracto) y "queHacer" (qué negociar o preguntar). Mira especialmente: exclusividad, no competencia y su duración, propiedad intelectual que se lleve trabajos anteriores, penalizaciones desproporcionadas, plazos de pago largos o sin fecha, renovación automática, jurisdicción en otro país, pruebas técnicas no remuneradas de más de 4 horas, y cualquier cosa que fije obligaciones para él sin fijar ninguna para la empresa. Si el documento está limpio, lista vacía: NO inventes alarmas para rellenar.
- encaje: si es una descripción de puesto o una prueba técnica, cómo cuadra con su perfil real y qué le falta. Si es un contrato o una propuesta, si las condiciones encajan con lo que él busca (${p.preferencias.salarioObjetivo || "expectativa salarial sin definir"}, ${p.preferencias.modalidad || "modalidad sin definir"}). Cadena vacía si el documento no da para opinar.
- huecos: lo que el documento NO dice y debería. Esto suele ser más caro que lo que sí dice. Por ejemplo: no fija fecha de pago, no dice quién paga las herramientas, no define qué pasa si el cliente cancela, no aclara si las horas son fijas. Lista vacía si está todo cubierto.
- preguntasQueHacer: preguntas concretas que debería mandar por escrito antes de comprometerse. Redactadas tal cual para copiar y pegar. Entre 2 y 6.

No des consejo legal definitivo ni digas si debe firmar. Señala qué mirar y qué preguntar. Si algo del documento es ambiguo, dilo como ambiguo en lugar de elegir la interpretación que suene mejor.`;
}
