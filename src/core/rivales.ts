/**
 * Datos de los rivales: tipos de gladiador de la Roma antigua y fieras. Cada ataque avisa con un color:
 * amarillo = se puede bloquear, rojo = solo esquivar, azul = el bloqueo perfecto lo devuelve con mucho aturdimiento.
 */

export type ColorAtaque = 'amarillo' | 'rojo' | 'azul';
export type TipoAtaque = 'golpe' | 'proyectil' | 'red' | 'embestida' | 'zarpazo';

export interface DefAtaque {
  nombre: string;
  tipo: TipoAtaque;
  color: ColorAtaque;
  /** Segundos de aviso antes del impacto y de recuperación después. */
  aviso: number;
  recuperacion: number;
  /** Distancia a la que lo usa. */
  alcance: number;
  arco: number;
  dano: number;
  /** Radio del zarpazo (área alrededor del rival). */
  radio?: number;
  /** Proyectiles: velocidad y cantidad (en abanico). */
  velocidad?: number;
  cantidad?: number;
  peso: number;
  recarga: number;
}

export type TipoRival =
  | 'tiro' | 'murmillo' | 'retiario' | 'hoplomaco' | 'dimaquero' | 'sagitario'
  | 'lobo' | 'oso' | 'leon' | 'toro';

/** Arma que lleva el modelo 3D. */
export type ArmaRival = 'gladius' | 'lanza' | 'tridente' | 'dosEspadas' | 'arco' | 'ninguna';

export interface DatosRival {
  nombre: string;
  vida: number;
  velocidad: number;
  radio: number;
  /** Escala del modelo. */
  escala: number;
  aturdMax: number;
  /** Distancia a la que prefiere quedarse. */
  distancia: number;
  ataques: DefAtaque[];
  /** Coste en el presupuesto del combate, oro y fama que da. */
  coste: number;
  oro: number;
  fama: number;
  /** Fracción del daño que para su armadura. */
  armadura: number;
  /** Bloquea de frente con el escudo hasta que se le rompe la guardia. */
  escudo?: boolean;
  /** No se tambalea con los golpes ligeros. */
  firme?: boolean;
  /** Probabilidad base de esquivar un ataque que ve venir. */
  esquiva: number;
  arma: ArmaRival;
  fiera?: boolean;
  /** Primer combate en que aparece. */
  desde: number;
}

const golpe = (dano: number, color: ColorAtaque = 'amarillo', extra: Partial<DefAtaque> = {}): DefAtaque => ({
  nombre: 'Golpe', tipo: 'golpe', color, aviso: 0.65, recuperacion: 0.7, alcance: 2.3, arco: 1.6, dano, peso: 3, recarga: 1.3, ...extra,
});

export const RIVALES: Record<TipoRival, DatosRival> = {
  tiro: {
    nombre: 'Tiro', vida: 55, velocidad: 2.8, radio: 0.4, escala: 1, aturdMax: 45, distancia: 1.8, coste: 2, oro: 8, fama: 3, armadura: 0, esquiva: 0.05, arma: 'gladius', desde: 1,
    ataques: [golpe(9), golpe(15, 'rojo', { nombre: 'Estocada', aviso: 0.9, alcance: 2.5, arco: 0.8, peso: 1, recarga: 4 })],
  },
  murmillo: {
    nombre: 'Murmillo', vida: 80, velocidad: 2.4, radio: 0.45, escala: 1.05, aturdMax: 55, distancia: 1.8, coste: 3, oro: 12, fama: 5, armadura: 0.15, escudo: true, esquiva: 0, arma: 'gladius', desde: 1,
    ataques: [golpe(12, 'azul', { nombre: 'Golpe de escudo', aviso: 0.7 }), golpe(11), golpe(18, 'rojo', { nombre: 'Tajo bajo', aviso: 0.85, peso: 1, recarga: 5 })],
  },
  retiario: {
    nombre: 'Retiario', vida: 60, velocidad: 3.3, radio: 0.4, escala: 1, aturdMax: 40, distancia: 3.2, coste: 3, oro: 12, fama: 5, armadura: 0, esquiva: 0.25, arma: 'tridente', desde: 2,
    ataques: [
      golpe(10, 'amarillo', { nombre: 'Tridente', alcance: 3.4, arco: 0.8 }),
      { nombre: 'Red', tipo: 'red', color: 'rojo', aviso: 0.8, recuperacion: 1, alcance: 9, arco: 0, dano: 4, velocidad: 13, cantidad: 1, peso: 2, recarga: 7 },
    ],
  },
  hoplomaco: {
    nombre: 'Hoplómaco', vida: 75, velocidad: 2.6, radio: 0.45, escala: 1.05, aturdMax: 55, distancia: 3, coste: 4, oro: 14, fama: 6, armadura: 0.2, escudo: true, esquiva: 0.05, arma: 'lanza', desde: 3,
    ataques: [golpe(13, 'amarillo', { nombre: 'Lanzada', alcance: 3.8, arco: 0.6 }), { nombre: 'Carga con lanza', tipo: 'embestida', color: 'rojo', aviso: 0.8, recuperacion: 1, alcance: 8, arco: 0.5, dano: 18, peso: 1, recarga: 6 }],
  },
  dimaquero: {
    nombre: 'Dimaquero', vida: 70, velocidad: 3.4, radio: 0.42, escala: 1, aturdMax: 50, distancia: 1.8, coste: 4, oro: 14, fama: 6, armadura: 0.05, esquiva: 0.3, arma: 'dosEspadas', desde: 4,
    ataques: [golpe(8, 'amarillo', { nombre: 'Doble tajo', aviso: 0.45, recuperacion: 0.45 }), golpe(16, 'azul', { nombre: 'Tijera', aviso: 0.7, arco: 2.2 }), golpe(20, 'rojo', { nombre: 'Remolino', aviso: 0.9, arco: Math.PI * 2, alcance: 2.6, peso: 1, recarga: 5 })],
  },
  sagitario: {
    nombre: 'Sagitario', vida: 45, velocidad: 2.6, radio: 0.4, escala: 1, aturdMax: 35, distancia: 9, coste: 3, oro: 11, fama: 4, armadura: 0, esquiva: 0.2, arma: 'arco', desde: 3,
    ataques: [{ nombre: 'Flecha', tipo: 'proyectil', color: 'amarillo', aviso: 0.8, recuperacion: 0.8, alcance: 15, arco: 0, dano: 9, velocidad: 17, cantidad: 1, peso: 3, recarga: 2.2 }],
  },
  lobo: {
    nombre: 'Lobo', vida: 38, velocidad: 4.8, radio: 0.45, escala: 1, aturdMax: 30, distancia: 1.6, coste: 1, oro: 5, fama: 2, armadura: 0, esquiva: 0.1, arma: 'ninguna', fiera: true, desde: 2,
    ataques: [golpe(7, 'amarillo', { nombre: 'Mordisco', aviso: 0.45, recuperacion: 0.5, alcance: 1.9 }), { nombre: 'Salto', tipo: 'embestida', color: 'amarillo', aviso: 0.55, recuperacion: 0.8, alcance: 6, arco: 0.6, dano: 10, peso: 1, recarga: 4 }],
  },
  leon: {
    nombre: 'León', vida: 110, velocidad: 4.4, radio: 0.6, escala: 1.25, aturdMax: 70, distancia: 1.9, coste: 5, oro: 18, fama: 8, armadura: 0, esquiva: 0.1, arma: 'ninguna', fiera: true, firme: true, desde: 4,
    ataques: [golpe(14, 'amarillo', { nombre: 'Zarpa', aviso: 0.5, alcance: 2.2 }), { nombre: 'Abalanzarse', tipo: 'embestida', color: 'rojo', aviso: 0.7, recuperacion: 1, alcance: 8, arco: 0.5, dano: 20, peso: 2, recarga: 4 }],
  },
  oso: {
    nombre: 'Oso', vida: 170, velocidad: 2.8, radio: 0.8, escala: 1.5, aturdMax: 100, distancia: 2.2, coste: 6, oro: 22, fama: 9, armadura: 0.1, esquiva: 0, arma: 'ninguna', fiera: true, firme: true, desde: 5,
    ataques: [golpe(16, 'amarillo', { nombre: 'Zarpazo', alcance: 2.8, arco: 2, aviso: 0.75 }), { nombre: 'Golpe en el suelo', tipo: 'zarpazo', color: 'rojo', aviso: 1, recuperacion: 1.2, alcance: 3.2, arco: 0, dano: 22, radio: 3.6, peso: 1, recarga: 5 }],
  },
  toro: {
    nombre: 'Toro', vida: 140, velocidad: 3, radio: 0.75, escala: 1.4, aturdMax: 80, distancia: 2.4, coste: 5, oro: 18, fama: 8, armadura: 0.05, esquiva: 0, arma: 'ninguna', fiera: true, firme: true, desde: 3,
    ataques: [golpe(14, 'amarillo', { nombre: 'Cornada', alcance: 2.4, arco: 1.2, aviso: 0.6 }), { nombre: 'Embestida', tipo: 'embestida', color: 'rojo', aviso: 0.9, recuperacion: 1.4, alcance: 14, arco: 0.4, dano: 24, peso: 3, recarga: 3.5 }],
  },
};

export const HUMANOS: TipoRival[] = ['tiro', 'murmillo', 'retiario', 'hoplomaco', 'dimaquero', 'sagitario'];
export const FIERAS: TipoRival[] = ['lobo', 'toro', 'leon', 'oso'];

/** Nombres inventados para los campeones (se combinan para que no se repitan pronto). */
const NOMBRES = ['Aulo', 'Brennio', 'Cayo', 'Decio', 'Fausto', 'Galeno', 'Lucio', 'Marco', 'Nerón', 'Opio', 'Petronio', 'Rufo', 'Septimio', 'Tulio', 'Valerio', 'Zósimo'];
const APODOS = ['el Implacable', 'Mano de Hierro', 'el Toro', 'Sin Miedo', 'el Muro', 'Rayo', 'el Carnicero', 'Piel de León', 'el Silencioso', 'Colmillo'];

export function nombreCampeon(n: number): string {
  return `${NOMBRES[(n * 7) % NOMBRES.length]} ${APODOS[(n * 3 + Math.floor(n / NOMBRES.length)) % APODOS.length]}`;
}
