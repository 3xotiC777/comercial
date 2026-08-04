# Centro de Solicitudes D&N

Ticketera web publicada en GitHub Pages y conectada a SharePoint Online.

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

La ventana de cierre guarda la respuesta en la lista y los archivos en
`Comercial planeacion proyecto/{Ticket}/Solucion`. Para activarla, agrega estas
columnas a la lista **Comercial planeacion**:

- `Solución`: varias líneas de texto, texto sin formato. Obligatoria para cerrar desde la aplicación.
- `Archivos solución`: una línea de texto. Guarda los nombres de los archivos.
- `Fecha finalización`: fecha y hora. Permite calcular el tiempo promedio real del panel.

Después actualiza el flujo **Cuando se modifique un elemento** para que, cuando
`Estado` sea `Finalizado`, incluya `Solución` en el cuerpo del correo y adjunte
los archivos encontrados en la carpeta `{Título}/Solucion` de la biblioteca.
La aplicación carga primero los archivos y cambia el estado al final, por lo que
Power Automate siempre recibe un cierre completo.

En pruebas, Diego, Miguel y Rony se asignan en la interfaz. Antes de producción, agrega sus correos al flujo de Power Automate y al arreglo `adminEmails` en `src/TicketApp.tsx`.

## Permisos recomendados de SharePoint

Para que el área comercial no vea solicitudes ajenas, en la configuración avanzada de la lista limita la lectura y edición a los elementos creados por cada usuario. Concede al grupo interno de Planeación permiso de edición sobre todos los elementos.
