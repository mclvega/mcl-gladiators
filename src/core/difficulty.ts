export type Dificultad = 'muyFacil' | 'facil' | 'normal' | 'desafio';

export interface Modo {
  nombre: string;
  /** Multiplicador de la vida de los rivales. */
  vida: number;
  /** Multiplicador del daño de los rivales. */
  dano: number;
  /** Ventana del bloqueo perfecto, en segundos. */
  parry: number;
  /** Multiplicador del oro y la fama ganados. */
  oro: number;
  /** Rivales que pueden atacarte cuerpo a cuerpo a la vez. */
  atacantes: number;
}

export const MODOS: Record<Dificultad, Modo> = {
  muyFacil: { nombre: 'Muy fácil', vida: 0.55, dano: 0.4, parry: 0.35, oro: 0.8, atacantes: 1 },
  facil: { nombre: 'Fácil', vida: 0.75, dano: 0.7, parry: 0.25, oro: 0.9, atacantes: 1 },
  normal: { nombre: 'Normal', vida: 1, dano: 1, parry: 0.18, oro: 1, atacantes: 2 },
  desafio: { nombre: 'Desafío', vida: 1.3, dano: 1.35, parry: 0.12, oro: 1.25, atacantes: 3 },
};

export const DIFICULTADES = Object.keys(MODOS) as Dificultad[];

/**
 * Escala de los rivales según el número de combate (no hay final: crece sin límite).
 * `ia` va de 0 a 1: avisos más cortos y más esquivas de los rivales.
 */
export function escalaCombate(n: number) {
  const k = Math.max(0, n - 1);
  return { vida: 1 + k * 0.12, dano: 1 + k * 0.07, presupuesto: 3 + k * 0.8, ia: Math.min(1, k / 25), oro: 1 + k * 0.15 };
}
