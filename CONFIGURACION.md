# Publicar Biblioteca en GitHub Pages

La carpeta `docs/` contiene el sitio estático. No subas la base SQLite, el entorno `.venv` ni secretos.

## Google OAuth institucional

El Client ID público del cliente OAuth web está configurado en `static/config.js` (`googleClientId`) y en `CFG.CLIENT_ID` de Apps Script. Ambos valores deben coincidir. El cliente web debe autorizar el origen JavaScript `https://musulmani777.github.io`, sin ruta.

`CFG.ADMIN_EMAIL` debe ser el correo que recibirá los avisos. Después de cambiar el Client ID o el correo en el código de Apps Script, despliega una nueva versión de la aplicación web. Confirma también que `CFG.DOMINIO` sea `escuelasantafilomena.cl`.

No se necesita ni se debe publicar el Client Secret. `CLAVE_ADMIN` debe configurarse en las propiedades del proyecto Apps Script y permanecer fuera del código y de GitHub.

## GitHub Pages

Sube el contenido de `docs/` a la raíz del repositorio `musulmani777/biblioteca-santafilomena`. En **Settings → Pages**, elige desplegar desde la rama `main` y la carpeta `/(root)`. La URL del sitio será:

`https://musulmani777.github.io/biblioteca-santafilomena/`

La interfaz usa el Apps Script indicado en `static/config.js`. Para evitar el bloqueo CORS del navegador, envía las solicitudes mediante un formulario oculto y un iframe; `Code.gs` debe incluir el mismo puente y estar desplegado como una nueva versión de la aplicación web. Mantén el acceso de la implementación en **Cualquiera** y conserva la URL `/exec`. Los clientes antiguos que envían JSON directamente siguen recibiendo respuestas JSON.

Las operaciones protegidas se envían después de iniciar sesión con Google y la API también valida el token.

## Reglas que impone el Apps Script actual

- Solo se muestra la Sala de Biblioteca.
- Se usan los ocho bloques de 45 minutos definidos en `BLOQUES` dentro de Apps Script.
- Las solicitudes requieren al menos cinco días hábiles de anticipación y hasta 30 alumnos.
- La disponibilidad se consulta sin token; crear, listar y cancelar reservas exige un ID token OAuth válido.
