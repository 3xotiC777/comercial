# Gestión de solicitudes

El área interna combina búsqueda por ticket, solicitante, correo, responsable y texto de solicitud/respuesta con filtros de analista, negocio, país, tipo, prioridad, cumplimiento y fechas de creación. También respeta el periodo y estado seleccionados. Estos filtros locales no alteran los KPI superiores ni el CSV completo; «Limpiar filtros» restablece todos, incluido periodo y estado.

## Prioridad automática

- Muestra: Alta.
- Cotizaciones / Cotización / Análisis (con o sin tilde): Media.
- Otros: Baja.
- Un tipo desconocido no recibe una prioridad inventada.

La app deriva la prioridad del tipo, incluyendo tickets existentes. En la lista «Comercial planeacion», «Prioridad» es una columna calculada que devuelve texto. La fórmula aceptada por la configuración regional del sitio es:

```text
=IF(TRIM([tipo])="Muestra";"Alta";IF(OR(TRIM([tipo])="Cotizaciones";TRIM([tipo])="Cotizacion";TRIM([tipo])="Cotización";TRIM([tipo])="Analisis";TRIM([tipo])="Análisis");"Media";IF(TRIM([tipo])="Otros";"Baja";"")))
```

No se envía la prioridad en PATCH porque SharePoint la calcula. La columna manual recién creada fue reemplazada con autorización; no se borraron tickets.

## Fecha compromiso

Columna opcional «Fecha compromiso», tipo fecha sin hora, sin valor predeterminado. El equipo interno puede asignarla o quitarla desde cada ticket. No se asignan fechas retroactivas a los tickets existentes.

El plazo vence al terminar el día en Bogotá. «Próximo a vencer» comprende los tres días calendario anteriores; no es un SLA de horas laborales. Para finalizados se compara la fecha real de cierre, nunca la última modificación. Sin cierre registrado se muestra «Cierre sin fecha».

La escritura de compromiso modifica únicamente esa columna, comprueba que no haya cambiado desde la lectura y usa ETag/If-Match para evitar sobrescrituras concurrentes. Un conflicto pide actualizar antes de reintentar. Los cambios de estado y responsable también conservan esa protección. No se modificaron los flujos de correo.

## Historial

Se consulta al abrir «Historial», usando las versiones reales de SharePoint y sus autores/fechas. La lista tenía versionado habilitado con retención de 50 versiones al configurar esta función. No se promete un registro ilimitado ni se reconstruyen versiones eliminadas.

Se muestran diferencias de campos de seguimiento de más reciente a más antiguo; los textos enriquecidos se convierten a texto seguro. La prioridad histórica se deriva del tipo de esa versión y se etiqueta «Prioridad según tipo». Los cambios de archivos que no generen una versión del elemento de lista no aparecen como eventos independientes.

La consulta pagina las versiones y obtiene sus campos en lotes de 20. Si falla alguna consulta se informa el error, sin presentar un historial parcial como completo. Referencia: [versiones de un elemento](https://learn.microsoft.com/en-us/graph/api/listitem-list-versions?view=graph-rest-1.0) y [campos de una versión](https://learn.microsoft.com/en-us/graph/api/listitemversion-get?view=graph-rest-1.0).

El CSV completo agrega prioridad, compromiso y cumplimiento. «Mis solicitudes» muestra estos tres datos sin permitir editarlos.
