# Exportación del histórico de tickets

En el área interna, **Descargar CSV completo** consulta de nuevo todos los tickets y los nombres de sus archivos en SharePoint. No aplica los filtros de mes ni de estado del tablero. No modifica tickets ni dispara correos.

Incluye 27 columnas: identificadores, creación, inicio, finalización, última actualización, estado, responsable, solicitante, correo, CC, negocio, país, estudio, tipo, detalle, respuesta, horas calendario hasta finalizar, nombres de archivos e imágenes de solicitud y solución, enlaces a SharePoint, prioridad automática, fecha compromiso y cumplimiento. Los enlaces requieren permisos corporativos; no contienen credenciales ni enlaces temporales de descarga.

Las fechas están en hora de Bogotá (UTC-05). Una fecha no registrada queda vacía. La última modificación no se usa como fecha de cierre. Las horas calendario transcurren desde la creación hasta el cierre y no equivalen a horas laboradas por el analista.

El detalle y la solución se convierten a texto legible manteniendo saltos de línea. CSV no incrusta imágenes ni adjuntos: exporta nombres y un enlace a la carpeta. Se consultan las cuatro carpetas de cada ticket, con paginación y lotes de hasta 20 consultas. Una carpeta inexistente se considera sin archivos; otros errores impiden emitir un archivo incompleto y muestran un mensaje para reintentar.

Formato: UTF-8 con BOM, separador punto y coma, directiva inicial `sep=;` para Excel, celdas entre comillas y protección de valores que pueden interpretarse como fórmulas. Al importar con otras herramientas, omitir la primera línea `sep=;`. El archivo contiene datos personales y debe compartirse únicamente con personas autorizadas.

Pruebas: `pnpm test`, `pnpm run build`, `pnpm lint` y descarga real desde el área interna.
