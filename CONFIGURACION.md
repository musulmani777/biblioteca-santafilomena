# Publicar Biblioteca en GitHub Pages

La carpeta `docs/` contiene el sitio estático. No subas la base SQLite, el entorno `.venv` ni secretos.

## Requisito pendiente: OAuth institucional

El inicio de sesión no se habilita hasta que el administrador de Google Workspace configure un OAuth Client ID web. La cuenta disponible no puede acceder a Cloud Console por una restricción de Workspace for Education; no existe un permiso local que la quite.

El administrador debe:

1. Crear un cliente OAuth de tipo aplicación web en un proyecto de Google Cloud de la escuela.
2. Autorizar el origen JavaScript `https://musulmani777.github.io`.
3. Configurar el mismo Client ID público en `static/config.js` (`googleClientId`) y en `CFG.CLIENT_ID` de Apps Script.
4. Confirmar que `CFG.DOMINIO` en Apps Script sea `escuelasantafilomena.cl` y desplegar una nueva versión de la aplicación web.

No se necesita ni se debe publicar el Client Secret. `CLAVE_ADMIN` debe permanecer en las propiedades del proyecto Apps Script, nunca en los archivos de GitHub.

## GitHub Pages

Sube el contenido de `docs/` a la raíz del repositorio `musulmani777/biblioteca-santafilomena`. En **Settings → Pages**, elige desplegar desde la rama `main` y la carpeta `/(root)`. La URL del sitio será:

`https://musulmani777.github.io/biblioteca-santafilomena/`

La interfaz usa el Apps Script indicado en `static/config.js`. Solo envía solicitudes administrativas después de verificar la sesión Google; la API también valida el token.

## Reglas que impone el Apps Script actual

- Solo se muestra la Sala de Biblioteca.
- Se usan los ocho bloques de 45 minutos definidos en `BLOQUES` dentro de Apps Script.
- Las solicitudes requieren al menos cinco días hábiles de anticipación y hasta 30 alumnos.
- La disponibilidad se consulta sin token; crear, listar y cancelar reservas exige un ID token OAuth válido.
