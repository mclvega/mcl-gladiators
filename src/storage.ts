import { IDS_ARMAS } from './core/armas';
import { crearPieza, equipoInicial, RANURAS, type ArmaEquipada, type Equipo, type Pieza } from './core/equipo';
import { atributosIniciales, ATRIBUTOS, type Atributos } from './core/progreso';
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from './game/look';
import { configPorDefecto, normalizarConfig, type Configuracion } from './settings';

export interface Record_ {
  nombre: string;
  /** Combate más alto ganado. */
  combate: number;
  fama: number;
  fecha: string;
}

export interface Estadisticas {
  combates: number;
  victorias: number;
  derrotas: number;
  bajas: number;
  campeones: number;
  perfectos: number;
  oroTotal: number;
}

const estadisticasNuevas = (): Estadisticas => ({ combates: 0, victorias: 0, derrotas: 0, bajas: 0, campeones: 0, perfectos: 0, oroTotal: 0 });

export interface Guardado {
  v: 1;
  nombre: string | null;
  /** Siguiente combate (el nivel): solo sube al ganar. */
  combate: number;
  oro: number;
  fama: number;
  atributos: Atributos;
  equipo: Equipo;
  arma: ArmaEquipada;
  /** Ofertas de la tienda ya compradas en el combate `tienda.combate`. */
  tienda: { combate: number; compradas: number[] };
  records: Record_[];
  estadisticas: Estadisticas;
  /** Apariencia del gladiador (mismo sistema de personajes que el Arcade). */
  look: Look;
  config: Configuracion;
}

export const CLAVE_GUARDADO = 'mcl-gladiators:v1';
const MAX_RECORDS = 10;

export const guardadoNuevo = (): Guardado => ({
  v: 1, nombre: null, combate: 1, oro: 40, fama: 0, atributos: atributosIniciales(), equipo: equipoInicial(), arma: { id: 'gladius', nivel: 1 },
  tienda: { combate: 1, compradas: [] }, records: [], estadisticas: estadisticasNuevas(),
  look: { ...DEFAULT_LOOK, shirt: 0xe53935, hair: 'short', hairColor: 0x2b1d14, facialHair: 'stubble', body: 'strong', hat: 'none', bottom: 'skirt', bottomColor: 0x6d4c41 } as Look,
  config: configPorDefecto(),
});

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const entero = (v: unknown, min: number, max: number, porDefecto: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : porDefecto;

function normalizarRecord(v: unknown): Record_ | null {
  if (!esObjeto(v) || typeof v.nombre !== 'string' || typeof v.fecha !== 'string') return null;
  return { nombre: v.nombre.slice(0, 20), combate: entero(v.combate, 1, 1e6, 1), fama: entero(v.fama, 0, 1e9, 0), fecha: v.fecha };
}

/** Orden de la tabla: más lejos y, a igualdad, más fama. */
const comparar = (a: Record_, b: Record_) => b.combate - a.combate || b.fama - a.fama;

function normalizarEstadisticas(v: unknown): Estadisticas {
  const e = estadisticasNuevas();
  if (!esObjeto(v)) return e;
  for (const k of Object.keys(e) as Array<keyof Estadisticas>) e[k] = entero(v[k], 0, 1e9, 0);
  return e;
}

function normalizarAtributos(v: unknown): Atributos {
  const a = atributosIniciales();
  if (!esObjeto(v)) return a;
  for (const { id } of ATRIBUTOS) a[id] = entero(v[id], 0, 1000, 0);
  return a;
}

/** Una pieza guardada se rehace con sus datos (nivel y durabilidad) para que no se puedan inflar a mano. */
function normalizarPieza(v: unknown, ranura: Pieza['ranura']): Pieza | null {
  if (!esObjeto(v)) return null;
  const nivel = entero(v.nivel, 1, 1000, 1);
  const p = crearPieza(ranura, nivel);
  const defensa = typeof v.defensa === 'number' && Number.isFinite(v.defensa) ? v.defensa : p.defensa;
  // La calidad puede variar algo la defensa; no se acepta más de lo posible.
  p.defensa = Math.min(p.defensa + 0.03, Math.max(0, defensa));
  if (typeof v.peso === 'number' && Number.isFinite(v.peso)) p.peso = Math.max(p.peso * 0.8, Math.min(p.peso * 1.2, v.peso));
  p.durMax = entero(v.durMax, 1, Math.round(p.durMax * 1.2), p.durMax);
  p.durabilidad = entero(v.durabilidad, 0, p.durMax, p.durMax);
  return p;
}

function normalizarEquipo(v: unknown): Equipo {
  if (!esObjeto(v)) return equipoInicial();
  const e = {} as Equipo;
  for (const r of RANURAS) e[r] = normalizarPieza(v[r], r);
  return e;
}

/** Cada rasgo debe ser una de las opciones conocidas; si no, se usa el de por defecto. */
export function normalizarLook(entrada: unknown, porDefecto: Look): Look {
  if (!esObjeto(entrada)) return { ...porDefecto };
  const look = { ...porDefecto } as Record<string, unknown>;
  for (const [clave, opciones] of Object.entries(LOOK_OPTIONS)) {
    const valor = entrada[clave];
    const validos = (opciones as readonly unknown[]).map((o) => (typeof o === 'object' && o ? (o as { id: string }).id : o));
    if (validos.includes(valor)) look[clave] = valor;
  }
  return look as unknown as Look;
}

/** Valida datos guardados: cualquier campo dañado vuelve a su valor por defecto. */
export function normalizarGuardado(entrada: unknown): Guardado {
  const base = guardadoNuevo();
  if (!esObjeto(entrada)) return base;
  const records = Array.isArray(entrada.records)
    ? entrada.records.map(normalizarRecord).filter((r): r is Record_ => r !== null).sort(comparar).slice(0, MAX_RECORDS)
    : [];
  const arma = esObjeto(entrada.arma) && IDS_ARMAS.includes(entrada.arma.id as ArmaEquipada['id'])
    ? { id: entrada.arma.id as ArmaEquipada['id'], nivel: entero(entrada.arma.nivel, 1, 1000, 1) }
    : base.arma;
  const tienda = esObjeto(entrada.tienda) && Array.isArray(entrada.tienda.compradas)
    ? { combate: entero(entrada.tienda.combate, 1, 1e6, 1), compradas: entrada.tienda.compradas.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < 10) }
    : base.tienda;
  return {
    v: 1,
    nombre: typeof entrada.nombre === 'string' ? limpiarNombre(entrada.nombre) : null,
    combate: entero(entrada.combate, 1, 1e6, 1),
    oro: entero(entrada.oro, 0, 1e9, base.oro),
    fama: entero(entrada.fama, 0, 1e9, 0),
    atributos: normalizarAtributos(entrada.atributos),
    equipo: normalizarEquipo(entrada.equipo),
    arma,
    tienda,
    records,
    estadisticas: normalizarEstadisticas(entrada.estadisticas),
    look: normalizarLook(entrada.look, base.look),
    config: normalizarConfig(entrada.config),
  };
}

/** Una fila por jugador: se sustituye solo si el nuevo récord es mejor. */
export function agregarRecord(g: Guardado, r: Record_): boolean {
  const previo = g.records.find((x) => x.nombre === r.nombre);
  if (previo && comparar(previo, r) <= 0) return false;
  g.records = g.records.filter((x) => x !== previo);
  g.records.push(r);
  g.records.sort(comparar);
  g.records = g.records.slice(0, MAX_RECORDS);
  return g.records.includes(r);
}

export interface ResultadoCombate {
  victoria: boolean;
  bajas: number;
  oro: number;
  fama: number;
  perfectos: number;
  campeon: boolean;
}

/** Anota un combate: al ganar se cobra el premio y se pasa al siguiente; al perder se queda en el mismo. */
export function anotarCombate(g: Guardado, r: ResultadoCombate, nombre: string): void {
  const e = g.estadisticas;
  e.combates++;
  e.bajas += r.bajas;
  e.perfectos += r.perfectos;
  if (!r.victoria) {
    e.derrotas++;
    return;
  }
  e.victorias++;
  e.oroTotal += r.oro;
  if (r.campeon) e.campeones++;
  g.oro += r.oro;
  g.fama += r.fama;
  agregarRecord(g, { nombre, combate: g.combate, fama: g.fama, fecha: new Date().toISOString().slice(0, 10) });
  g.combate++;
}

/** Nombre del jugador: 1 a 20 caracteres; letras, espacios, punto, apóstrofo y guion. */
export function limpiarNombre(texto: string): string | null {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 20);
  return /^[\p{L}\p{M}\d .'-]{1,20}$/u.test(limpio) ? limpio : null;
}

function almacenSeguro(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function cargar(almacen: Pick<Storage, 'getItem'> | null = almacenSeguro()): Guardado {
  try {
    const texto = almacen?.getItem(CLAVE_GUARDADO);
    return texto ? normalizarGuardado(JSON.parse(texto)) : guardadoNuevo();
  } catch {
    return guardadoNuevo();
  }
}

export function guardar(g: Guardado, almacen: Pick<Storage, 'setItem'> | null = almacenSeguro()): void {
  try {
    almacen?.setItem(CLAVE_GUARDADO, JSON.stringify(g));
  } catch {
    // Sin almacenamiento (ventana privada o bloqueado): el juego sigue en memoria.
  }
}
