# DT Sudamericano

Juego de manager de fútbol para el celular. Sos el DT de un club de cualquiera de las 10 ligas de Sudamérica y tomás las decisiones: once, táctica, mercado de pases, finanzas, estadio e infraestructura. La dificultad está pensada entre *El Camino DT* y *Footy Owner 2*: tácticas simples, partidos rápidos de seguir y un sistema económico con peso.

Tiene dos modos de pantalla que se eligen desde el inicio (o en **Club → Partida**): **celular**, en una columna, y **ordenador**, que usa todo el ancho con pestañas arriba, tarjetas en columnas, cancha horizontal y el partido en vivo con la cancha grande al lado del relato.

No necesita instalación: es un único archivo `index.html` que funciona en cualquier navegador (también sin conexión, salvo las tipografías).

## Cómo jugar

- Abrí `index.html` en el navegador del celular, o publicalo con GitHub Pages (Settings → Pages → rama principal, carpeta raíz).
- La partida se guarda sola en el dispositivo. Desde **Club → Partida** podés exportarla e importarla.

## Qué incluye

**Competencias**
- 10 ligas con los equipos de la temporada 2026: Argentina (30 equipos), Brasil (20), Uruguay, Chile, Colombia, Paraguay, Perú, Ecuador, Bolivia y Venezuela.
- Segunda división jugable en Argentina (Primera Nacional, 36 equipos), Brasil (Série B), Uruguay (Segunda División) y Chile (Liga de Ascenso): los que descienden la juegan y suben los primeros de la tabla. En el resto de los países los ascendidos salen de un grupo de clubes del ascenso.
- Copas nacionales con equipos de primera y segunda.
- Copa Libertadores y Copa Sudamericana: 32 equipos cada una, 8 grupos, playoffs de la Sudamericana con los terceros de la Libertadores, llaves a ida y vuelta y final única.
- Recopa Sudamericana y Copa Intercontinental contra el campeón de Europa.
- Clasificación real a las copas según la posición en la liga y el campeón de la copa nacional.

**Partidos**
- Partido en la cancha: cada minuto simulado se ve como una jugada. El equipo con la pelota avanza con pases (con su estela) y conducciones, el rival presiona y corta pases, y los remates terminan en gol, atajada o afuera. En los goles la pelota entra al arco, el marcador cambia en ese momento y el goleador festeja antes del saque del medio.
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
- Conferencias de prensa, representantes que ofrecen jugadores, recitales en el estadio, alertas físicas antes de un partido, peleas en el vestuario, visitas solidarias, cambios de horario por la TV, el coordinador de inferiores tentado por otro club, desafíos de la directiva, veteranos que piensan en el retiro, polémicas en redes, tormentas en el estadio, clubes grandes que tientan a tus promesas, pedidos de aumento, jugadores que quieren irse, presión de la barra, semana de clásico, indisciplina, giras y campañas publicitarias, tratamientos médicos, reclamos de socios, inversores, joyas de inferiores, convocatorias a la selección y clubes que quieren llevarte en plena temporada.

**Dificultad**
- Arcade: empezás en el club que quieras.
- Realista: solo podés arrancar en clubes de segunda división o en los más modestos de primera, con poca reputación como DT. Las ofertas de clubes más grandes llegan a medida que cumplís objetivos y ascendés.

**Carrera larga**
- Juveniles cada temporada (con un aviso en pantalla cuando suben al plantel), evolución y declive de jugadores, retiros, vencimiento y renovación de contratos.
- Directiva con objetivos y confianza: si te despiden, recibís ofertas de otros clubes; si te va bien, te buscan clubes más grandes.
- Historial de campeones, vitrina del club y trayectoria del DT.

## Datos

Qué equipos juegan en cada división corresponde a la temporada 2026. Los escudos reales se cargan desde [football-logos.cc](https://football-logos.cc) (catálogo del paquete `football-logos`); sin conexión, o para los pocos clubes que no están en el catálogo, se muestra un escudo dibujado con los colores del club. Los estadios y planteles son aproximados a la temporada 2025/26. Los equipos grandes tienen planteles reales; los clubes con pocos datos completan su plantel con jugadores generados con nombres típicos de cada país. Cualquier nombre se puede corregir desde la ficha del jugador.

## Desarrollo

El código fuente está en `src/` (motor del juego en `src/game`, datos en `src/data`, interfaz en `src/ui`).

```bash
node tools/build.js          # genera index.html y dist/artifact.html
node tools/sim_test.js 3     # simula 3 temporadas completas sin interfaz y muestra estadísticas
NODE_PATH=$(npm root -g) node tools/ui_test.js shots   # recorre la interfaz con Playwright
```
