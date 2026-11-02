import { ARMAS, IDS_ARMAS, type IdArma } from './armas';
import { crearRng, type Rng } from './rng';

/**
 * Equipo por zonas: cada pieza protege una parte del cuerpo y se desgasta con los golpes que recibe.
 * Rota (durabilidad 0), esa zona recibe el daño completo hasta que se repara en el ludus.
 */

export type Zona = 'cabeza' | 'torso' | 'brazoEscudo' | 'brazoArma' | 'piernas';
export type Ranura = Zona | 'escudo';

export const ZONAS: Zona[] = ['cabeza', 'torso', 'brazoEscudo', 'brazoArma', 'piernas'];
export const RANURAS: Ranura[] = [...ZONAS, 'escudo'];

export const NOMBRE_RANURA: Record<Ranura, { nombre: string; icono: string }> = {
  cabeza: { nombre: 'Casco', icono: '⛑️' },
  torso: { nombre: 'Peto', icono: '🦺' },
  brazoEscudo: { nombre: 'Brazal izquierdo', icono: '🦾' },
  brazoArma: { nombre: 'Brazal derecho', icono: '💪' },
  piernas: { nombre: 'Grebas', icono: '🦵' },
  escudo: { nombre: 'Escudo', icono: '🛡️' },
};

/** Probabilidad de que un golpe caiga en cada zona. */
export const PESO_ZONA: Record<Zona, number> = { cabeza: 0.16, torso: 0.38, brazoEscudo: 0.15, brazoArma: 0.13, piernas: 0.18 };

export interface Pieza {
  ranura: Ranura;
  nombre: string;
  nivel: number;
  /** Fracción del daño que para (0 a 0,6). En el escudo, la que para al bloquear. */
  defensa: number;
  peso: number;
  durabilidad: number;
  durMax: number;
}

export type Equipo = Record<Ranura, Pieza | null>;

export interface ArmaEquipada {
  id: IdArma;
  nivel: number;
}

const MATERIALES = ['de cuero', 'de bronce', 'de hierro', 'de acero', 'de acero templado', 'del campeón'];

/** Material según el nivel (los niveles altos repiten el último, con un número). */
export function material(nivel: number): string {
  const i = Math.min(MATERIALES.length - 1, Math.floor((nivel - 1) / 3));
  const extra = nivel > MATERIALES.length * 3 ? ` +${nivel - MATERIALES.length * 3}` : '';
  return `${MATERIALES[i]}${extra}`;
}

/** Pieza nueva de una ranura y nivel. `calidad` en [0, 1] varía un poco la defensa y el peso. */
export function crearPieza(ranura: Ranura, nivel: number, calidad = 0.5): Pieza {
  const escudo = ranura === 'escudo';
  const base = escudo ? 0.55 : ranura === 'torso' ? 0.18 : 0.14;
  const defensa = Math.min(escudo ? 0.92 : 0.6, base + nivel * (escudo ? 0.025 : 0.022) + (calidad - 0.5) * 0.04);
  const pesoBase = escudo ? 3 : ranura === 'torso' ? 3 : ranura === 'cabeza' ? 1.5 : 1;
  const durMax = Math.round((escudo ? 90 : 60) * (1 + (nivel - 1) * 0.18) * (0.9 + calidad * 0.2));
  return {
    ranura, nombre: `${NOMBRE_RANURA[ranura].nombre} ${material(nivel)}`, nivel,
    defensa: Math.round(defensa * 1000) / 1000,
    peso: Math.round(pesoBase * (1 + nivel * 0.06) * (1.1 - calidad * 0.2) * 10) / 10,
    durabilidad: durMax, durMax,
  };
}

export const equipoInicial = (): Equipo => ({
  cabeza: null, torso: crearPieza('torso', 1, 0.3), brazoEscudo: null, brazoArma: crearPieza('brazoArma', 1, 0.3), piernas: null, escudo: crearPieza('escudo', 1, 0.3),
});

/** Zona que recibe un golpe (según el número aleatorio que se pase). */
export function zonaGolpeada(azar: number): Zona {
  let t = azar;
  for (const z of ZONAS) {
    t -= PESO_ZONA[z];
    if (t < 0) return z;
  }
  return 'torso';
}

/**
 * Daño que pasa la armadura de una zona y desgaste de la pieza.
 * Sin pieza o con la pieza rota, pasa todo el daño.
 */
export function danoConArmadura(dano: number, pieza: Pieza | null): { dano: number; desgaste: number } {
  if (!pieza || pieza.durabilidad <= 0) return { dano, desgaste: 0 };
  return { dano: dano * (1 - pieza.defensa), desgaste: Math.max(1, dano * 0.6) };
}

export const pesoEquipo = (e: Equipo, arma: ArmaEquipada) => RANURAS.reduce((s, r) => s + (e[r]?.peso ?? 0), 0) + ARMAS[arma.id].peso;

/* ---------- Ludus: tienda y armería ---------- */

/** Precio de reparar una pieza (proporcional a lo que le falta). */
export function precioReparar(p: Pieza): number {
  const falta = 1 - p.durabilidad / p.durMax;
  return falta <= 0 ? 0 : Math.max(1, Math.ceil(falta * (8 + p.nivel * 6)));
}

export const precioPieza = (p: Pieza) => Math.round(25 * p.nivel * (1 + p.defensa) + p.durMax * 0.2);
export const precioArma = (a: ArmaEquipada) => Math.round(ARMAS[a.id].precio + 45 * (a.nivel - 1) + 30);
/** Lo que te dan por lo que sustituyes. */
export const precioVenta = (precio: number) => Math.floor(precio * 0.3);

export type Oferta = { tipo: 'pieza'; pieza: Pieza; precio: number } | { tipo: 'arma'; arma: ArmaEquipada; precio: number };

/** Género de la tienda para el combate `n`: cuatro piezas y un arma, de nivel cada vez más alto. */
export function generarTienda(n: number): Oferta[] {
  const rng: Rng = crearRng(n * 7919 + 17);
  const nivelMax = 1 + Math.floor(n / 2);
  const nivel = () => Math.max(1, nivelMax - rng.entero(0, 1));
  const ranuras = [...RANURAS];
  const ofertas: Oferta[] = [];
  for (let i = 0; i < 4; i++) {
    const ranura = ranuras.splice(rng.entero(0, ranuras.length - 1), 1)[0];
    const pieza = crearPieza(ranura, nivel(), rng.siguiente());
    ofertas.push({ tipo: 'pieza', pieza, precio: precioPieza(pieza) });
  }
  const arma: ArmaEquipada = { id: rng.elegir(IDS_ARMAS), nivel: Math.max(1, Math.floor(nivelMax * 0.8)) };
  ofertas.push({ tipo: 'arma', arma, precio: precioArma(arma) });
  return ofertas;
}
