/** Armas del gladiador: combos de golpes en arco delante de él. */

export type IdArma = 'gladius' | 'lanza' | 'tridente' | 'hacha' | 'maza';

/** Efecto propio del arma: la red atrapa, la maza aturde más y el hacha parte escudos. */
export type EfectoArma = 'critico' | 'alcance' | 'red' | 'parteEscudos' | 'aturde';

export interface Golpe {
  dano: number;
  /** Alcance en metros y apertura del arco en radianes. */
  alcance: number;
  arco: number;
  /** Duración total y momento del impacto (fracción de la duración). */
  duracion: number;
  impacto: number;
  /** Carga de la barra de aturdimiento (y de guardia en los rivales con escudo). */
  aturd: number;
  /** Paso hacia delante al golpear. */
  avance: number;
  /** Estamina que gasta. */
  estamina: number;
}

export interface Arma {
  nombre: string;
  icono: string;
  texto: string;
  efecto: EfectoArma;
  ligero: Golpe[];
  fuerte: Golpe;
  /** Peso en kg (afecta a la velocidad y a la recuperación de la estamina). */
  peso: number;
  /** Precio base en la tienda (nivel 1). */
  precio: number;
}

const g = (dano: number, alcance: number, arco: number, duracion: number, aturd: number, estamina: number, extra: Partial<Golpe> = {}): Golpe => ({
  dano, alcance, arco, duracion, impacto: 0.45, aturd, avance: 0.6, estamina, ...extra,
});

export const ARMAS: Record<IdArma, Arma> = {
  gladius: {
    nombre: 'Gladius', icono: '🗡️', texto: 'Rápida y con más golpes críticos.', efecto: 'critico', peso: 2, precio: 0,
    ligero: [g(11, 2.3, 1.6, 0.34, 6, 9), g(11, 2.3, 1.6, 0.32, 6, 9), g(16, 2.5, 2.2, 0.44, 10, 11, { avance: 1 })],
    fuerte: g(26, 2.6, 1.4, 0.7, 20, 20, { impacto: 0.55, avance: 1.2 }),
  },
  lanza: {
    nombre: 'Lanza', icono: '🔱', texto: 'Mucho alcance: golpea antes de que te alcancen.', efecto: 'alcance', peso: 3, precio: 60,
    ligero: [g(12, 3.6, 0.7, 0.42, 6, 10), g(12, 3.6, 0.7, 0.42, 6, 10), g(18, 3.9, 1.2, 0.5, 10, 13, { avance: 1.2 })],
    fuerte: g(28, 4.2, 0.6, 0.78, 18, 22, { impacto: 0.6, avance: 1.5 }),
  },
  tridente: {
    nombre: 'Tridente y red', icono: '🕸️', texto: 'El ataque fuerte lanza la red: atrapa al rival unos segundos.', efecto: 'red', peso: 3, precio: 90,
    ligero: [g(10, 3.2, 0.9, 0.4, 6, 10), g(10, 3.2, 0.9, 0.4, 6, 10), g(15, 3.4, 1.4, 0.48, 9, 12, { avance: 1 })],
    fuerte: g(8, 9, 0.5, 0.6, 10, 24, { impacto: 0.5, avance: 0 }),
  },
  hacha: {
    nombre: 'Hacha', icono: '🪓', texto: 'Lenta, pero parte la guardia de los escudos.', efecto: 'parteEscudos', peso: 4, precio: 120,
    ligero: [g(16, 2.5, 1.8, 0.5, 9, 13), g(16, 2.5, 1.8, 0.5, 9, 13), g(22, 2.7, 2.4, 0.6, 14, 15, { avance: 1 })],
    fuerte: g(38, 2.8, 1.6, 0.9, 30, 26, { impacto: 0.6, avance: 1.2 }),
  },
  maza: {
    nombre: 'Maza', icono: '🔨', texto: 'Golpes que aturden mucho: abre huecos para rematar.', efecto: 'aturde', peso: 5, precio: 150,
    ligero: [g(14, 2.3, 1.6, 0.5, 16, 13), g(14, 2.3, 1.6, 0.5, 16, 13), g(20, 2.5, 2.4, 0.62, 24, 15, { avance: 0.9 })],
    fuerte: g(34, 2.6, 2.2, 0.95, 46, 26, { impacto: 0.62, avance: 1 }),
  },
};

export const IDS_ARMAS = Object.keys(ARMAS) as IdArma[];

/** Daño del arma según su nivel (+12 % por nivel). */
export const multNivelArma = (nivel: number) => 1 + Math.max(0, nivel - 1) * 0.12;

/** Golpe de gloria: onda alrededor del gladiador cuando el público está entregado. */
export const GOLPE_GLORIA: Golpe = { dano: 55, alcance: 4.8, arco: Math.PI * 2, duracion: 0.8, impacto: 0.55, aturd: 60, avance: 0, estamina: 0 };
