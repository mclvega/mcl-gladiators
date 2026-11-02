# McL Gladiators

Combates de gladiadores en 3D para el navegador, tácticos y con hack and slash. Empiezas como novato en el ludus y luchas combate tras combate, sin final: cada uno es algo más difícil que el anterior.

- **Combate táctico**: todo gasta **estamina** (atacar, esquivar y bloquear). Si te quedas sin ella mientras bloqueas, se **rompe tu guardia**. Ataque ligero en combo, **ataque fuerte cargable** (mantener), esquiva con invulnerabilidad, escudo y **bloqueo perfecto** (aturde y abre una ventana de contraataque).
- **Avisos de color**: amarillo se puede bloquear, rojo hay que esquivarlo y azul se castiga con un bloqueo perfecto.
- **Equipo por zonas**: casco, peto, brazales, grebas y escudo. Cada golpe cae en una zona y desgasta su pieza; rota, esa zona recibe el daño completo. Se repara en la armería.
- **Armas**: gladius (críticos), lanza (alcance), tridente y red (atrapa), hacha (parte escudos) y maza (aturde).
- **Fervor del público**: sube con los combos, los bloqueos perfectos, los remates y la variedad. Lleno, permite el **golpe de gloria** y mejora el premio.
- **Combates sin fin**: duelo, uno contra varios, supervivencia por oleadas, fieras (lobos, toros, leones y osos) y un **campeón** cada 5 combates. Arenas con columnas, carros, muretes y trampas de pinchos (que también hieren a los rivales).
- **El ludus**: tienda (género nuevo tras cada victoria), entrenador (fuerza, aguante, destreza y vida, sin tope) y armería. Rangos por fama: Novato, Aprendiz, Luchador, Veterano, Campeón y Leyenda I, II, III…
- **Controles**: teclado y ratón; **mando** físico (Xbox, PlayStation o genérico, también en el móvil, con navegación de menús); y en el móvil dos modos táctiles a elegir en Configuración: **completo** (joystick y botones grandes) o **modo PSP** (el mando de la PSP en pantalla).
- Funciona sin conexión (PWA) y el progreso queda en el navegador.

Publicado en https://mcl-gladiators.netlify.app

## Desarrollo

```sh
npm install
npm run dev      # ?demo empieza un combate directamente; ?tactil simula el móvil
npm test
npm run build
```

`src/core/*` es la lógica pura (combate y estamina, armas, equipo, progreso, rivales, generador de combates, arena, controles, física y navegación A*), `src/game/logica.ts` el combate, `src/game/ia.ts` los rivales y `src/game/render3d.ts` el dibujo con three.js.
