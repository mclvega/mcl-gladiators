import { ARMAS, multNivelArma } from './armas';
import { pesoEquipo, type ArmaEquipada, type Equipo } from './equipo';

/** Atributos que se entrenan en el ludus con oro. */
export type IdAtributo = 'fuerza' | 'aguante' | 'destreza' | 'vida';
export type Atributos = Record<IdAtributo, number>;

export const ATRIBUTOS: Array<{ id: IdAtributo; nombre: string; icono: string; texto: string }> = [
  { id: 'fuerza', nombre: 'Fuerza', icono: '💪', texto: '+8 % de daño y aguantas más peso.' },
  { id: 'aguante', nombre: 'Aguante', icono: '🫁', texto: '+10 de estamina y se recupera antes.' },
  { id: 'destreza', nombre: 'Destreza', icono: '🤸', texto: 'Más críticos, golpes más rápidos y esquivas más baratas.' },
  { id: 'vida', nombre: 'Vida', icono: '❤️', texto: '+15 de vida máxima.' },
];

export const atributosIniciales = (): Atributos => ({ fuerza: 0, aguante: 0, destreza: 0, vida: 0 });

/** Precio del siguiente punto (sube con cada punto que ya tienes). Sin tope. */
export const costeAtributo = (nivel: number) => Math.round(30 + nivel * 22 + nivel * nivel * 2);

export interface Stats {
  vidaMax: number;
  estaminaMax: number;
  /** Estamina recuperada por segundo. */
  regen: number;
  velocidad: number;
  dano: number;
  critico: number;
  /** Multiplicador de la velocidad de los golpes. */
  rapidez: number;
  /** Coste de la esquiva. */
  costeEsquiva: number;
  /** Peso total y la carga (peso / capacidad). */
  peso: number;
  carga: number;
}

/** Estadísticas del gladiador según sus atributos y lo que lleva puesto. */
export function calcularStats(a: Atributos, equipo: Equipo, arma: ArmaEquipada): Stats {
  const peso = pesoEquipo(equipo, arma);
  const capacidad = 18 + a.fuerza * 1.5;
  const carga = peso / capacidad;
  // Por encima de la capacidad se va más lento y se recupera menos.
  const lastre = Math.min(0.45, Math.max(0, carga - 0.6) * 0.6);
  return {
    vidaMax: 100 + a.vida * 15,
    estaminaMax: 100 + a.aguante * 10,
    regen: (30 + a.aguante * 2.5) * (1 - lastre),
    velocidad: 5.4 * (1 - lastre * 0.8),
    dano: (1 + a.fuerza * 0.08) * multNivelArma(arma.nivel),
    critico: Math.min(0.5, 0.05 + a.destreza * 0.015 + (ARMAS[arma.id].efecto === 'critico' ? 0.1 : 0)),
    rapidez: 1 + Math.min(0.5, a.destreza * 0.025),
    costeEsquiva: Math.max(10, 22 - a.destreza * 0.8),
    peso,
    carga,
  };
}

/* ---------- Fama y rangos ---------- */

const RANGOS: Array<[number, string]> = [[0, 'Novato'], [60, 'Aprendiz'], [180, 'Luchador'], [450, 'Veterano'], [1000, 'Campeón']];

/** Rango según la fama: después de Campeón vienen Leyenda I, II, III… sin fin (cada 1500 de fama). */
export function rangoDe(fama: number): { nombre: string; siguiente: number } {
  for (let i = RANGOS.length - 1; i >= 0; i--) {
    if (fama < RANGOS[i][0]) continue;
    if (i < RANGOS.length - 1) return { nombre: RANGOS[i][1], siguiente: RANGOS[i + 1][0] };
    const base = RANGOS[i][0] + 1500;
    if (fama < base) return { nombre: RANGOS[i][1], siguiente: base };
    const n = Math.floor((fama - base) / 1500) + 1;
    return { nombre: `Leyenda ${romano(n)}`, siguiente: base + n * 1500 };
  }
  return { nombre: RANGOS[0][1], siguiente: RANGOS[1][0] };
}

export function romano(n: number): string {
  const tabla: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  for (const [v, s] of tabla) {
    while (n >= v) {
      r += s;
      n -= v;
    }
  }
  return r;
}
