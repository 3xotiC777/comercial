# Centro de Solicitudes D&N

Aplicación estática lista para GitHub Pages. Sin configuración muestra una demostración; para producción usa el plan gratuito de Supabase para base de datos, archivos, acceso interno y correos.

## Publicar

1. Sube este proyecto a un repositorio GitHub.
2. En **Settings → Pages**, selecciona **GitHub Actions**.
3. Agrega los secretos `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_TEAM_EMAIL`.

## Activar producción

1. Crea un proyecto gratuito de Supabase y ejecuta `supabase/schema.sql` en SQL Editor.
2. Crea los usuarios internos desde **Authentication → Users** y ajusta la lista de correos permitidos del SQL si es necesario.
3. Despliega `supabase/functions/notify-ticket` y registra en Supabase los secretos `RESEND_API_KEY` y `TEAM_EMAIL`. La función envía al solicitante, al equipo y al analista asignado.
4. Para las pruebas, Diego, Miguel y Rony reciben los avisos en `dmontoya@dichter-neira.com`; cambia `analystEmails` antes de producción.

Nunca subas un archivo `.env` con claves reales.
