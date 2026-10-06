# Carpetas NFC — maqueta de campo

Maqueta funcional de la plataforma de gestión documental física-digital descrita en el DEF:
cada file físico lleva una llave QR o NFC, se escanea con el celular, se entra con contraseña
y se captura el documento con la cámara.

Es una sola página estática: **no hay servidor ni base de datos remota**. Todo vive en el
navegador del equipo donde se usa (IndexedDB). Sirve para validar el flujo y el hardware con
el cliente piloto, no para operar.

## Publicar con HTTPS

La cámara, el NFC y el cifrado del navegador solo funcionan sobre HTTPS, así que abrir el
archivo desde el celular no sirve. Con GitHub Pages:

1. Subir este repositorio a GitHub.
2. En **Settings → Pages**, elegir *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. Esperar un minuto y abrir `https://<usuario>.github.io/<repositorio>/`.

Antes de imprimir el primer lote de etiquetas, entrar a **Administración → Empresa y ajustes**
y confirmar la **URL base de los tags**. Los QR y los chips llevan esa dirección: si cambia,
los tags ya impresos o grabados dejan de abrir.

## Primer arranque

La primera vez pide crear la empresa y la cuenta de administrador. Desde esa cuenta se dan de
alta los demás usuarios con su contraseña y su rol. Opcionalmente carga files y documentos de
ejemplo, marcados con la etiqueta «ejemplo», para que el dashboard y la búsqueda no arranquen
vacíos; se quitan desde **Administración → Datos**.

Cada navegador guarda sus propios datos. Para trabajar en varios equipos, exportar la
estructura desde **Administración → Datos** e importarla en el otro. Los documentos y sus PDF
no viajan: quedan donde se capturaron.

## Las dos vistas

La vista se elige por el ancho de la pantalla, y se puede fijar en Administración.

- **Celular**: barra inferior con el botón central de escanear. Inicio, files, escanear,
  buscar y menú.
- **Escritorio**: barra lateral con dashboard, fichas madre, búsqueda, bandeja por archivar,
  etiquetas, administración, eventos y pruebas.

## Qué se puede probar

| Pipeline | Qué hace de verdad |
| --- | --- |
| Acceso por tag | QR real generado por file, lectura por cámara dentro de la app y por la cámara del sistema, lectura y grabación NFC en Android con Chrome. Mide milisegundos desde la lectura hasta ver la carpeta. |
| Paso previo de seguridad | Sin sesión, el tag lleva al login y después vuelve al file escaneado. Cinco intentos fallidos bloquean la cuenta un minuto. |
| Captura | Cámara real, varias páginas, reordenar y quitar, PDF multipágina armado en el equipo y huella SHA-256. |
| Estados | Con tag queda archivado; sin tag queda por archivar, y se confirma al escanear el tag o en lote desde la bandeja. |
| Búsqueda | Ignora mayúsculas y acentos, acepta partes de palabra, exige todos los términos y admite frases entre comillas. Busca en nombre, tipo, etiquetas, file, familia y texto OCR. |
| OCR | Tesseract en español dentro del navegador. Descarga el motor la primera vez. |
| Dashboard | Los cinco indicadores del DEF: documentos por familia y por tipo, capturados en cuatro semanas, pendientes y su antigüedad, files sin movimiento en 30 días y búsquedas sin resultado de la semana. |
| Etiquetas | Hoja A4 de tres por fila y rollo de 50 × 30 mm, para imprimir al 100 %. |

**Diagnóstico** dice si el equipo puede usar cámara, NFC y almacenamiento. **Pruebas físicas**
es la lista de comprobaciones con tags reales, con resultado, nota y un botón para copiarlas.

## Lo que esta maqueta no es

- **No es seguridad real.** El login y los roles existen para probar el flujo completo. Todo
  corre en el navegador: las contraseñas se guardan como hash PBKDF2-SHA256 con sal, pero
  cualquiera con acceso al equipo puede leer los datos. En el producto, la autorización vive
  en el backend y filtra por `company_id` en cada consulta.
- **No hay aislamiento entre empresas**, porque no hay servidor que lo aplique.
- **No hay detección de bordes ni corrección de perspectiva.** El DEF recomienda una
  biblioteca probada, y eso corresponde a la versión real.
- **Una huella SHA-256 no convierte un documento en evidencia legal.** Garantiza integridad.

El QR, el lector jsQR y el motor de OCR se descargan desde un CDN la primera vez que se usan,
así que esas tres funciones necesitan conexión.

## Estructura

```
index.html
assets/
  styles.css        tokens, cromo de celular y de escritorio, hoja de etiquetas
  core.js           estado, IndexedDB, usuarios y sesión, búsqueda, datos iniciales
  lib.js            QR, PDF, cámara, NFC, OCR
  ui.js             cromo, componentes y gráficos
  views-auth.js     primer arranque, login, perfil
  views-browse.js   inicio, dashboard, fichas madre, ficha del file, documento, búsqueda, bandeja
  views-capture.js  escanear, resolver tag, capturar, tag del file, etiquetas
  views-admin.js    administración, eventos, diagnóstico, pruebas físicas
  app.js            enrutador
```
