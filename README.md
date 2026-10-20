# FENIX · Panel Central

Panel web para administrar torneos, biblioteca de jugadores/equipos, fixture y posiciones.
Corre sobre el mismo Apps Script y las mismas planillas que el anotador y `fenix-stats.html`.

## Archivos

| Ruta | Qué es |
|---|---|
| `panel/index.html` | Página del panel |
| `panel/app.js` | Toda la lógica (sin dependencias) |
| `panel/styles.css` | Estilo "Estadio" |
| `apps-script/Code.gs` | Backend completo (reemplaza al actual) |

## Puesta en marcha (una sola vez)

1. **Apps Script:** abrí el proyecto, borrá todo el código y pegá `apps-script/Code.gs`. Guardá.
2. **Clave:** Configuración del proyecto → Propiedades del script → que exista `ADMIN_KEY` (la misma que ya usás para crear torneos).
3. **Implementar:** Implementar → Administrar implementaciones → lápiz → Versión: "Nueva versión" → Implementar. La URL `/exec` no cambia. Si pide permisos, aceptá.
4. **GitHub:** subí la carpeta `panel/` al repo. Con GitHub Pages queda en `https://<usuario>.github.io/<repo>/panel/`.
5. **Panel → Configuración:** pegá la URL `/exec` y la clave → "Guardar y probar".
6. **Crear hojas de biblioteca** y después **Importar plantel y equipos de las planillas actuales** (trae Masculino y Femenino, sin duplicar).
7. **Link del anotador (opcional):** por ejemplo `https://<usuario>.github.io/<repo>/anotador.html?planilla={planilla}&partido={partido}`.

## Cómo guarda los datos

- **Biblioteca:** dos pestañas nuevas en la planilla Índice: `Biblioteca_Jugadores` y `Biblioteca_Equipos`.
- **Fotos y logos:** se encuadran en el panel; a Drive se sube la imagen ya recortada (600×600 jugadores, 512×512 logos) y también la original para poder re-encuadrar. Al guardar, la foto/logo nuevo se actualiza en el Plantel/Equipos de todos los torneos activos.
- **Torneo nuevo:** se copia la plantilla como siempre (`crearTorneo`) y además se llenan `Plantel` (con el número de ese torneo) y `Equipos`. Se agregan las columnas `JugadorID` / `EquipoID` al final para vincular con la biblioteca.
- **Fixture:** columnas de siempre (`ID, Fecha, Dia, Hora, Local, GL, Visitante, GV, Instancia`) más `Cancha` al final. "Fecha" es la jornada (Fecha 1, Semifinal…) y "Dia" el día (dd/mm/aaaa). Los partidos nuevos reciben ID `P01`, `P02`…
- **Posiciones:** se calculan con los partidos de instancia Regular con resultado. Los puntos por victoria/empate/derrota se configuran en el panel (Propiedades del script `PUNTOS_G/E/P`).
- **Seguridad:** todas las operaciones del panel piden `ADMIN_KEY`. La URL y la clave quedan guardadas solo en el navegador de quien las cargó.
