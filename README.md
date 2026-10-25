# Centro de Solicitudes D&N

Ticketera web publicada en GitHub Pages y conectada a SharePoint Online.

## Navegación y seguimiento

La pantalla **Inicio** presenta el centro de solicitudes. **Nueva solicitud** guía al
solicitante por tres pasos y conserva los datos y adjuntos al avanzar o retroceder.
El registro requiere la confirmación final y el acceso corporativo de Microsoft.

El área interna separa **Dashboard** de **Consultar tickets**. El dashboard incluye
demanda y resolución mensual, estado actual, carga y desempeño por analista,
distribución por país y tipo, antigüedad de abiertos y cumplimiento de compromisos.
Los gráficos y las alertas permiten abrir la consulta con filtros relacionados.

Los indicadores se filtran por el mes de creación en hora de Bogotá. La evolución
mensual cuenta cada creación y cierre válido en el mes del evento; sólo considera
como cierres los tickets actualmente finalizados. Los tiempos excluyen fechas
ausentes, inválidas, anteriores a la creación o futuras. El cumplimiento compara
el cierre con la fecha compromiso actual y muestra su base de cálculo. El CSV
mantiene el histórico completo, independientemente de los filtros de pantalla.

Ejecuta `npm test`, `npm run lint` y `npm run build` para validar el proyecto.

## Recursos configurados

- Sitio: `https://dichterneiracorp.sharepoint.com/sites/reportingdn`
- Lista: `Comercial planeacion`
- Biblioteca de adjuntos: `Comercial planeacion proyecto`
- Identidad: Microsoft Entra ID con inicio de sesión corporativo.

No se requieren secretos ni claves privadas para la página. Cada persona inicia sesión con su cuenta corporativa y SharePoint aplica sus permisos.

En Microsoft Entra ID, la aplicación debe registrar como URI de redirección de tipo **Aplicación de página única (SPA)**: `https://3xotic777.github.io/comercial/auth.html`.

## Notificaciones por correo

Configura dos flujos de Power Automate desde la lista **Comercial planeacion**:

1. **Cuando se cree un elemento:** enviar un correo al solicitante y a `dmontoya@dichter-neira.com` con la información del ticket.
2. **Cuando se modifique un elemento:** agregar una condición para comprobar cambios en `Estado` o `Responsable`; enviar el correo al solicitante y al responsable asignado.

### Cierre con solución

La ventana de cierre guarda la respuesta en la lista y separa el contenido en
`{Ticket}/Solucion/Inline` para imágenes pegadas dentro del texto y
`{Ticket}/Solucion/Adjuntos` para Excel, PDF y otros archivos. Para activarla, agrega estas
columnas a la lista **Comercial planeacion**:

- `Solución`: varias líneas de texto, texto sin formato. Obligatoria para cerrar desde la aplicación.
- `Archivos solución`: una línea de texto. Guarda los nombres de los archivos.
- `Fecha finalización`: fecha y hora. Permite calcular el tiempo promedio real del panel.

Después actualiza el flujo **Cuando se modifique un elemento** para que, cuando
`Estado` sea `Finalizado`, tome el HTML de `Solución`, reemplace cada dirección
`inline://nombre-de-imagen` por el contenido Base64 del archivo correspondiente
en `{Título}/Solucion/Inline`, y adjunte los archivos encontrados en
`{Título}/Solucion/Adjuntos`.
La aplicación carga primero los archivos y cambia el estado al final, por lo que
Power Automate siempre recibe un cierre completo.

La aplicación optimiza cada imagen pegada a menos de 700 KB. Esto mantiene su
URI Base64 por debajo del límite de 1 MB del conector de correo de Office 365.

En pruebas, Diego, Miguel y Rony se asignan en la interfaz. Antes de producción, agrega sus correos al flujo de Power Automate y al arreglo `adminEmails` en `src/TicketApp.tsx`.

## Permisos recomendados de SharePoint

Para que el área comercial no vea solicitudes ajenas, en la configuración avanzada de la lista limita la lectura y edición a los elementos creados por cada usuario. Concede al grupo interno de Planeación permiso de edición sobre todos los elementos.

## Mis tickets

La pestaña **Mis tickets** tiene un botón **Iniciar sesión con Microsoft** y obtiene
automáticamente el correo de esa cuenta (o su nombre de usuario si no tiene correo).
Consulta SharePoint por ese correo, recorre todas las páginas del historial y muestra
el estado actual, el analista, la fecha de creación y la solución escrita para los
tickets finalizados. Incluye filtros de estado y un botón para actualizar los datos.
El acceso a los elementos sigue sujeto a los permisos de SharePoint descritos arriba;
el filtro de la interfaz no sustituye esos permisos.

La fecha de solución proviene de **Fecha finalización**. Si falta, o el ticket sigue
abierto, se muestra **Última actualización**, tomada de la fecha de modificación de
SharePoint (puede incluir cambios de responsable o de otros campos). Las soluciones
se muestran como texto seguro, conservando saltos de línea; las imágenes se indican
con un marcador y los nombres de los archivos se muestran como referencia.

Para consultas estables en listas grandes, crea un índice en la columna de correo
del solicitante en la configuración de columnas indexadas de SharePoint.

Pruebas de la consulta: `node --test tests/my-tickets.test.mjs`.

## Comentarios de tickets

**Mis tickets** permite al solicitante agregar comentarios y responder al equipo.
En el área interna, **Comentarios · Pedir información** abre el mismo historial.
Comentar no modifica el estado, el responsable ni las fechas del ticket; también
se conserva el historial de los tickets finalizados. El texto tiene un máximo de
5.000 caracteres y se muestra como texto seguro, con sus saltos de línea.

La lista **Comentarios Comercial** guarda un elemento por comentario:

| Columna interna | Configuración |
| --- | --- |
| `Title` | Texto obligatorio y único: UUID de envío, índice automático |
| `TicketId` | Texto obligatorio e indexado: ID de SharePoint del ticket |
| `Comment` | Varias líneas, texto sin formato, obligatorio |
| `Origin` | Texto obligatorio: `Solicitante` o `Analista` |
| `Notification` | Texto, valor predeterminado `Pendiente` |

Autor y fecha se obtienen de los metadatos de SharePoint. La aplicación comprueba
la cuenta corporativa y el correo del ticket guardado antes de consultar o enviar.
Un reintento conserva el mismo UUID para recuperar un comentario ya guardado.
La lista hereda los mismos permisos del sitio que **Comercial planeacion**;
los filtros de la aplicación no sustituyen los permisos de SharePoint.

El flujo **Comentarios tickets - Gmail** se dispara al crear un comentario.
Verifica el autor contra el solicitante o el equipo autorizado, obtiene los
destinatarios del ticket y envía desde `reporting.dichterneira@gmail.com`:

- Comentario del solicitante: avisa al equipo.
- Comentario del analista: avisa al solicitante y copia al equipo.
- En ambos casos conserva `CC` del ticket, normaliza los separadores y elimina
  duplicados. El equipo incluye a Diego, Francisco, Miguel y Rony, igual que los
  avisos existentes. La lista de cuentas del área interna está en `src/team.ts`.

El flujo procesa un envío a la vez y solo procesa registros `Pendiente`.
Antes de enviar marca `Enviando`; después marca `Enviado`. Si Gmail devuelve
un error o agota el tiempo, marca `Revisar` y no reintenta automáticamente el
correo, porque podría haberse entregado. Revisar el historial de ejecución y
la carpeta Enviados antes de volver a poner un registro en `Pendiente`.
El disparador es de creación: un reenvío requiere ejecutar de nuevo el historial
después de verificar el estado; editar el comentario no envía otro correo.

Pruebas de comentarios: `node --experimental-strip-types --test tests/comments.test.mjs`.
