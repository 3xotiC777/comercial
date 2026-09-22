# Copias de las notificaciones

## SharePoint

La lista **Comercial planeacion** contiene la columna **CC**, opcional,
de varias líneas de texto sin formato, sin anexar cambios y sin valor predeterminado.
Guarda direcciones separadas por punto y coma. No requiere migrar tickets anteriores:
una columna vacía equivale a no agregar copias.

La biblioteca **Comercial planeacion proyecto** conserva sus carpetas y archivos.
Los destinatarios son datos del ticket, no de cada archivo; no se duplican en la biblioteca.

## Aplicación

- “Nueva solicitud” permite indicar CC opcional.
- “Ver solicitud” muestra las copias guardadas.
- “Enviar solución” precarga CC y permite agregar, quitar o sustituir direcciones.
- Acepta punto y coma, coma o saltos de línea; elimina duplicados y al solicitante de CC.
- Valida direcciones y admite hasta 50 copias únicas.
- La solución y CC se guardan antes del cambio a Finalizado que dispara el correo.
- No otorga acceso adicional a SharePoint ni a “Mis solicitudes”.

## Power Automate

Configuración aplicada el 22 de septiembre de 2026. Se preservaron los destinatarios
principales, condiciones, cuerpo, imágenes y adjuntos existentes.

| Flujo | Acción con CC |
| --- | --- |
| Solicitud inicial planeacion | Enviar correo electrónico (V2) |
| Analista encargado planeacion | Enviar correo electrónico (V2) |
| Enviar solución al finalizar ticket | Redactar un mensaje de correo electrónico y Actualiza un borrador de un mensaje de correo electrónico |

Expresión de CC en las cuatro acciones:

```text
coalesce(triggerBody()?['CC'], '')
```

El flujo final debe conservar CC al actualizar el borrador después de insertar imágenes.
El correo se envía usando ese mismo borrador, con sus adjuntos existentes.

## Comprobación de entrega

Con destinatarios de prueba autorizados: crear una solicitud con CC, asignarla y
finalizarla con una imagen y un adjunto. Confirmar los tres correos en el historial
de ejecuciones y en los buzones. Probar también sin CC y quitar/agregar una copia
antes de finalizar. Las pruebas unitarias de normalización se ejecutan con `pnpm test`.
