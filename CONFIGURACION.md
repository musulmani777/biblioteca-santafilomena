# Publicar Biblioteca en GitHub Pages

La carpeta `docs/` contiene el sitio estático. No subas la base SQLite, el entorno `.venv` ni secretos.

## Acceso de profesores

La app solicita nombre y apellido, sin inicio de sesión con Google ni correo del profesor. Estos datos se guardan con la solicitud y se usan para mostrar el historial. Como no se verifica la identidad, otra persona podría ingresar el mismo nombre para consultar o cancelar esas reservas.

`CFG.ADMIN_EMAIL` es el correo que recibirá los avisos de nuevas solicitudes. `CLAVE_ADMIN` debe configurarse en las propiedades del proyecto Apps Script y permanecer fuera del código y de GitHub; las acciones de administración siguen protegidas por esa clave.

## GitHub Pages

Sube el contenido de `docs/` a la raíz del repositorio `musulmani777/biblioteca-santafilomena`. En **Settings → Pages**, elige desplegar desde la rama `main` y la carpeta `/(root)`. La URL del sitio será:

`https://musulmani777.github.io/biblioteca-santafilomena/`

La interfaz usa el Apps Script indicado en `static/config.js`. Para evitar el bloqueo CORS del navegador, envía las solicitudes mediante un formulario oculto y un iframe; `Code.gs` debe incluir el mismo puente y estar desplegado como una nueva versión de la aplicación web. Mantén el acceso de la implementación en **Cualquiera** y conserva la URL `/exec`. Los clientes antiguos que envían JSON directamente siguen recibiendo respuestas JSON.

Las solicitudes de profesores se envían con el nombre y apellido ingresados. No se envían tokens ni datos de autenticación de Google.

## Reglas que impone el Apps Script actual

- Solo se muestra la Sala de Biblioteca.
- Se usan los ocho bloques de 45 minutos definidos en `BLOQUES` dentro de Apps Script.
- Las solicitudes requieren al menos cinco días hábiles de anticipación y hasta 30 alumnos.
- El acceso de profesores no requiere token; crear, listar y cancelar reservas usa el nombre y apellido ingresados.
