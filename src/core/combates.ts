import { escalaCombate } from './difficulty';
import { crearRng, type Rng } from './rng';
import { FIERAS, HUMANOS, nombreCampeon, RIVALES, type TipoRival } from './rivales';

/**
 * Generador de combates: a partir del número de combate (y una semilla) decide las reglas y los rivales.
 * No hay final: cada combate es algo más difícil que el anterior.
 */

export type Regla = 'duelo' | 'grupo' | 'oleadas' | 'fieras' | 'campeon';

export const REGLAS: Record<Regla, { nombre: string; icono: string; texto: string }> = {
  duelo: { nombre: 'Duelo', icono: '⚔️', texto: 'Uno contra uno.' },
  grupo: { nombre: 'Uno contra varios', icono: '👥', texto: 'Varios rivales a la vez: muévete y no te dejes rodear.' },
  oleadas: { nombre: 'Supervivencia', icono: '🌊', texto: 'Aguanta tres oleadas seguidas.' },
  fieras: { nombre: 'Fieras', icono: '🐺', texto: 'Las puertas se abren y salen las fieras.' },
  campeon: { nombre: 'Campeón', icono: '👑', texto: 'Un campeón de la arena te reta. Más fuerte, más listo y más fama.' },
};

export interface RivalPlan {
  tipo: TipoRival;
  /** Campeón: más vida, más daño y no se tambalea. */
  campeon: boolean;
}

export interface Combate {
  n: number;
  regla: Regla;
  oleadas: RivalPlan[][];
  /** Nombre del campeón (solo en los combates de campeón). */
  campeon: string | null;
}

/** Tipos que ya pueden salir en el combate `n`. */
const disponibles = (lista: TipoRival[], n: number) => lista.filter((t) => RIVALES[t].desde <= n);

function reglaDe(n: number, rng: Rng): Regla {
  if (n % 5 === 0) return 'campeon';
  if (n <= 2) return 'duelo';
  const opciones: Array<[Regla, number]> = [['duelo', 3], ['grupo', 3], ['oleadas', n >= 4 ? 2 : 0], ['fieras', n >= 3 ? 2 : 0]];
  let t = rng.siguiente() * opciones.reduce((s, [, p]) => s + p, 0);
  for (const [r, p] of opciones) {
    t -= p;
    if (t < 0) return r;
  }
  return 'duelo';
}

/** Llena un presupuesto con rivales de la lista (al menos uno). */
function llenar(rng: Rng, lista: TipoRival[], presupuesto: number, max: number): RivalPlan[] {
  const grupo: RivalPlan[] = [];
  let resto = presupuesto;
  while (grupo.length < max) {
    const caben = lista.filter((t) => RIVALES[t].coste <= resto);
    if (!caben.length) break;
    const t = rng.elegir(caben);
    grupo.push({ tipo: t, campeon: false });
    resto -= RIVALES[t].coste;
  }
  if (!grupo.length) grupo.push({ tipo: lista.reduce((a, b) => (RIVALES[a].coste <= RIVALES[b].coste ? a : b)), campeon: false });
  return grupo;
}

export function generarCombate(n: number, semilla = 0): Combate {
  const rng = crearRng(n * 9973 + semilla * 131 + 5);
  const regla = reglaDe(n, rng);
  const esc = escalaCombate(n);
  const humanos = disponibles(HUMANOS, n);
  const fieras = disponibles(FIERAS, n);
  let oleadas: RivalPlan[][];
  switch (regla) {
    case 'duelo': {
      // En el duelo, un solo rival (cada vez más duro: lo escala la dificultad); desde el 12, a veces dos.
      const uno = { tipo: rng.elegir(humanos), campeon: false };
      oleadas = [n >= 12 && rng.siguiente() < 0.3 ? [uno, { tipo: rng.elegir(humanos), campeon: false }] : [uno]];
      break;
    }
    case 'grupo':
      oleadas = [llenar(rng, humanos, esc.presupuesto + 2, Math.min(5, 2 + Math.floor(n / 6)))];
      if (oleadas[0].length < 2) oleadas[0].push({ tipo: 'tiro', campeon: false });
      break;
    case 'oleadas':
      oleadas = [0, 1, 2].map((i) => llenar(rng, humanos, esc.presupuesto * (0.6 + i * 0.25), 2 + Math.floor(n / 8)));
      break;
    case 'fieras': {
      const lista = fieras.length ? fieras : ['lobo' as TipoRival];
      oleadas = [llenar(rng, lista, esc.presupuesto + 1, Math.min(5, 2 + Math.floor(n / 7)))];
      if (n >= 6 && rng.siguiente() < 0.5) oleadas.push(llenar(rng, lista, esc.presupuesto * 0.7, 3));
      break;
    }
    case 'campeon': {
      const tipo = rng.elegir(humanos.filter((t) => t !== 'sagitario'));
      const grupo: RivalPlan[] = [{ tipo, campeon: true }];
      // Los campeones de más adelante entran con ayudantes.
      if (n >= 15) grupo.push({ tipo: rng.elegir(humanos), campeon: false });
      if (n >= 30) grupo.push({ tipo: rng.elegir(humanos), campeon: false });
      oleadas = [grupo];
      break;
    }
  }
  return { n, regla, oleadas, campeon: regla === 'campeon' ? nombreCampeon(n) : null };
}

/** Recompensa por ganar: oro y fama, más si el público estaba entregado (fervor medio de 0 a 100). */
export function premioCombate(n: number, regla: Regla, fervorMedio: number, multModo: number): { oro: number; fama: number } {
  const esc = escalaCombate(n);
  const base = regla === 'campeon' ? 2.2 : regla === 'oleadas' ? 1.5 : regla === 'grupo' || regla === 'fieras' ? 1.25 : 1;
  const publico = 1 + Math.max(0, Math.min(100, fervorMedio)) / 200;
  return {
    oro: Math.round(25 * base * esc.oro * publico * multModo),
    fama: Math.round((8 + n * 2) * base * publico * multModo),
  };
}
