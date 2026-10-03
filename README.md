# DT Sudamericano

Juego de manager de fútbol para el celular. Sos el DT de un club de cualquiera de las 10 ligas de Sudamérica y tomás las decisiones: once, táctica, mercado de pases, finanzas, estadio e infraestructura. La dificultad está pensada entre *El Camino DT* y *Footy Owner 2*: tácticas simples, partidos rápidos de seguir y un sistema económico con peso.

No necesita instalación: es un único archivo `index.html` que funciona en cualquier navegador (también sin conexión, salvo las tipografías).

## Cómo jugar

- Abrí `index.html` en el navegador del celular, o publicalo con GitHub Pages (Settings → Pages → rama principal, carpeta raíz).
- La partida se guarda sola en el dispositivo. Desde **Club → Partida** podés exportarla e importarla.

## Qué incluye

**Competencias**
- 10 ligas: Argentina (30 equipos), Brasil (20), Uruguay, Chile, Colombia, Paraguay, Perú, Ecuador, Bolivia y Venezuela. Con descensos y ascensos.
- Copas nacionales (Copa Argentina, Copa do Brasil, etc.) a eliminación directa.
- Copa Libertadores y Copa Sudamericana: 32 equipos cada una, 8 grupos, playoffs de la Sudamericana con los terceros de la Libertadores, llaves a ida y vuelta y final única.
- Recopa Sudamericana y Copa Intercontinental contra el campeón de Europa.
- Clasificación real a las copas según la posición en la liga y el campeón de la copa nacional.

**Partidos**
- Cancha animada: los jugadores con su número y los colores del club se mueven según quién tiene la pelota; se ven los pases, los remates y los goles.
- Simulación minuto a minuto con relato, estadísticas, tarjetas, lesiones y penales. Clima de cada partido y sonidos (silbato, gol), que se pueden apagar.
- Partido en vivo con pausa, 3 velocidades, 5 cambios, mentalidad y presión ajustables, o resultado rápido desde el botón Simular.
- Clásicos (Superclásico, Fla-Flu, Gre-Nal, clásico uruguayo y más) con más público y más presión.
- Avisos antes del partido: titulares cansados, fuera de puesto, lesionados o suspendidos.
- Tácticas simples: 8 formaciones, 5 mentalidades y 3 niveles de presión.
- Cansancio, moral, suspensiones por amarillas y rotación cuando hay dos partidos por semana.

**Finanzas**
- Ingresos: taquilla (con precio de entrada ajustable), cuotas de socios, TV, sponsor principal (3 ofertas por temporada: fijo, por objetivo o por títulos), merchandising, premios CONMEBOL y ventas de jugadores (también al exterior).
- Gastos: sueldos, staff, mantenimiento, obras, viajes y préstamos.
- Préstamos bancarios con cuotas, tope salarial de la directiva, presupuesto de fichajes, evolución de la caja y balances por temporada.
- Ampliación del estadio y mejoras de centro de entrenamiento, divisiones inferiores y departamento médico.

**Mercado**
- Ojeadores: el potencial de los jugadores de otros clubes queda oculto hasta que mandás a observarlos.
- Préstamos: cedé jugadores para que sumen minutos o pedí a préstamo jugadores de otros clubes hasta fin de temporada.
- Porcentaje de futura venta: al vender podés quedarte con el 20% de una próxima transferencia.
- Comparar jugadores con los mejores de tu plantel en ese puesto.
- Tope salarial negociable: arranca en la masa salarial actual, renovar sin subir el sueldo siempre está permitido, y podés pedirle a la directiva que lo amplíe (dos veces por temporada; depende de su confianza y de la caja).

**Eventos con decisiones**
- Conferencias de prensa, pedidos de aumento, jugadores que quieren irse, presión de la barra, semana de clásico, indisciplina, giras y campañas publicitarias, tratamientos médicos, reclamos de socios, inversores, joyas de inferiores, convocatorias a la selección y clubes que quieren llevarte en plena temporada.

**Carrera larga**
- Juveniles cada temporada, evolución y declive de jugadores, retiros, vencimiento y renovación de contratos.
- Directiva con objetivos y confianza: si te despiden, recibís ofertas de otros clubes; si te va bien, te buscan clubes más grandes.
- Historial de campeones, vitrina del club y trayectoria del DT.

## Datos

Los clubes, estadios y planteles son aproximados a la temporada 2025/26. Los equipos grandes tienen planteles reales; los clubes con pocos datos completan su plantel con jugadores generados con nombres típicos de cada país. Cualquier nombre se puede corregir desde la ficha del jugador.

## Desarrollo

El código fuente está en `src/` (motor del juego en `src/game`, datos en `src/data`, interfaz en `src/ui`).

```bash
node tools/build.js          # genera index.html y dist/artifact.html
node tools/sim_test.js 3     # simula 3 temporadas completas sin interfaz y muestra estadísticas
NODE_PATH=$(npm root -g) node tools/ui_test.js shots   # recorre la interfaz con Playwright
```
