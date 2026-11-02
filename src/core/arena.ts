import { bloque, type Bloque } from './fisica';
import { crearRng } from './rng';

/** Aspecto de la arena (se repiten en ciclo). */
export interface Tema {
  nombre: string;
  suelo: number;
  piedra: number;
  madera: number;
  cielo: number;
  niebla: number;
  luz: number;
  /** Gradas de piedra (coliseo) o empalizada de madera. */
  gradas: boolean;
  antorchas: boolean;
}

export const TEMAS: Tema[] = [
  { nombre: 'Arena del pueblo', suelo: 0xc9a36a, piedra: 0x9c8b72, madera: 0x7a5a3a, cielo: 0x9fd0f0, niebla: 0xc8dcea, luz: 0xfff4dc, gradas: false, antorchas: false },
  { nombre: 'Coliseo', suelo: 0xdcc08a, piedra: 0xcbbd9c, madera: 0x8a6a48, cielo: 0x8cc4ef, niebla: 0xd6e4ee, luz: 0xffffff, gradas: true, antorchas: false },
  { nombre: 'Arena nocturna', suelo: 0x8a7354, piedra: 0x6e6658, madera: 0x5a4030, cielo: 0x0b1530, niebla: 0x101830, luz: 0x8fa0d0, gradas: true, antorchas: true },
  { nombre: 'Arena del desierto', suelo: 0xe0b878, piedra: 0xb59a6a, madera: 0x8a6440, cielo: 0xf2c48a, niebla: 0xf0d6aa, luz: 0xffe6c0, gradas: false, antorchas: false },
  { nombre: 'Gran Coliseo', suelo: 0xd2b27a, piedra: 0xe6dcc6, madera: 0x6a4a30, cielo: 0x7ab4e8, niebla: 0xcfe0ee, luz: 0xffffff, gradas: true, antorchas: true },
];

export const temaDe = (n: number) => TEMAS[Math.floor((n - 1) / 3) % TEMAS.length];

/** Arena circular de cada combate, con columnas, carros, muretes y trampas de pinchos. */
export interface Arena {
  radio: number;
  bloques: Bloque[];
  /** Puntos de aparición de los rivales (en el borde, lejos del jugador). */
  apariciones: Array<{ x: number; z: number }>;
  inicio: { x: number; z: number };
  /** Trampas de pinchos: hieren a quien las pisa (también a los rivales). */
  trampas: Array<{ x: number; z: number; r: number }>;
  /** Antorchas del borde (solo visuales). */
  adornos: Array<{ x: number; z: number; giro: number }>;
}

export function generarArena(semilla: number, n: number, despejada: boolean): Arena {
  const rng = crearRng(semilla * 31 + 7);
  const radio = despejada ? 17 : rng.rango(15, 19);
  const inicio = { x: 0, z: radio * 0.6 };
  const bloques: Bloque[] = [];
  const libre = (x: number, z: number) =>
    Math.hypot(x - inicio.x, z - inicio.z) > 4 && Math.hypot(x, z) > 3.5 && bloques.every((b) => Math.hypot(b.x - x, b.z - z) > 4.5);

  // Obstáculos: más a medida que se avanza (hasta un tope), menos en los combates de campeón.
  const n0 = despejada ? rng.entero(1, 3) : Math.min(8, 2 + Math.floor(n / 3) + rng.entero(0, 2));
  for (let i = 0, intentos = 0; i < n0 && intentos < 200; intentos++) {
    const a = rng.siguiente() * Math.PI * 2;
    const r = rng.rango(4.5, radio - 3.5);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!libre(x, z)) continue;
    const t = rng.siguiente();
    if (t < 0.45) bloques.push(bloque('torre', x, z, 1.2, 1.2, 4.5, 0, 0));
    else if (t < 0.75) bloques.push(bloque('caja', x, z, 1.6, 2.6, 1.3, 0, 1));
    else bloques.push(bloque('pared', x, z, rng.rango(2.5, 4), 0.6, 1.1, 0, 2));
    i++;
  }

  const apariciones: Arena['apariciones'] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rng.rango(-0.15, 0.15);
    const x = Math.cos(a) * (radio - 2);
    const z = Math.sin(a) * (radio - 2);
    if (Math.hypot(x - inicio.x, z - inicio.z) < 8) continue;
    if (bloques.some((b) => Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1)) continue;
    apariciones.push({ x, z });
  }

  // Trampas desde el combate 4.
  const trampas: Arena['trampas'] = [];
  const nt = n >= 4 && !despejada ? Math.min(4, 1 + Math.floor((n - 4) / 4)) : 0;
  for (let i = 0, intentos = 0; i < nt && intentos < 100; intentos++) {
    const a = rng.siguiente() * Math.PI * 2;
    const r = rng.rango(3, radio - 3);
    const c = { x: Math.cos(a) * r, z: Math.sin(a) * r, r: rng.rango(1.1, 1.7) };
    if (Math.hypot(c.x - inicio.x, c.z - inicio.z) < c.r + 3) continue;
    if (bloques.some((b) => Math.hypot(b.x - c.x, b.z - c.z) < c.r + 2)) continue;
    trampas.push(c);
    i++;
  }

  const adornos: Arena['adornos'] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    adornos.push({ x: Math.cos(a) * (radio + 0.9), z: Math.sin(a) * (radio + 0.9), giro: a });
  }
  return { radio, bloques, apariciones, inicio, trampas, adornos };
}
