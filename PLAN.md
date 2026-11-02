# Plan: McL Gladiators (combates de gladiadores, tácticos y sin fin)

## Qué es

Juego original del género de gladiadores en arena, con combate táctico (estamina, escudo, bloqueo perfecto) y hack and slash (combos, ataque cargado, golpe de gloria). Sin nombres, personajes, historia ni sistemas copiados de juegos comerciales; la ambientación romana (ludus, tipos de gladiador, arenas) es de dominio público.

## Bucle

1. El ludus: tienda, entrenador, armería y el siguiente combate.
2. Combate N (generado por `src/core/combates.ts`): duelo, uno contra varios, oleadas, fieras o campeón (cada 5).
3. Victoria: oro y fama (más con el público entregado) y se pasa al combate N + 1. Derrota: se repite el combate; el equipo sigue gastado.

## Controles

Fachada `src/core/controles.ts` con las acciones; la alimentan el teclado y el ratón, el mando físico (`src/core/input.ts`, Gamepad API) y el táctil elegido en Configuración: completo (`src/ui/tactil.ts`) o PSP (`src/ui/psp.ts`). Los menús se recorren con el mando (`src/ui/navmando.ts`).

## Reglas comunes (netlify/CLAUDE.md)

3D con three.js, avatares del Arcade para los gladiadores y fieras low-poly con el mismo estilo, 4 dificultades (`MODOS`: vida, daño, ventana del bloqueo perfecto, oro y atacantes a la vez), configuración común, pantalla completa, modo oscuro AMOLED, PWA y `rendimiento.ts`.

## Ideas siguientes

- Más armas (red sola, espada larga) y escudos con efectos.
- Torneos: varios combates seguidos sin pasar por el ludus.
- Compañero de ludus en los combates por parejas.
