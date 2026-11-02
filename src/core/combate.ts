import type { ColorAtaque } from './rivales';

/** Diferencia de ángulos en [-π, π]. */
export const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Ángulo de mirada (yaw) de A hacia B. Adelante es -z, como en la cámara. */
export const yawHacia = (ax: number, az: number, bx: number, bz: number) => Math.atan2(-(bx - ax), -(bz - az));

/** ¿Está B (con su radio) dentro del arco de un golpe que sale de A mirando a `yaw`? */
export function enArco(ax: number, az: number, yaw: number, bx: number, bz: number, radioB: number, alcance: number, arco: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  if (d > alcance + radioB) return false;
  if (arco >= Math.PI * 2 - 1e-6 || d < radioB) return true;
  return Math.abs(angulo(yawHacia(ax, az, bx, bz) - yaw)) <= arco / 2 + Math.atan2(radioB, Math.max(d, 0.01));
}

export type Defensa = 'parry' | 'bloqueo' | 'golpe';

/**
 * Resultado de un ataque contra el jugador:
 * - Los rojos no se pueden bloquear.
 * - El escudo solo para lo que viene de delante (unos 200°).
 * - Si el escudo se levantó hace menos de `ventana` segundos, es un bloqueo perfecto.
 */
export function defensa(color: ColorAtaque, bloqueando: boolean, tiempoBloqueo: number, ventana: number, deFrente: boolean): Defensa {
  if (!bloqueando || color === 'rojo' || !deFrente) return 'golpe';
  return tiempoBloqueo <= ventana ? 'parry' : 'bloqueo';
}

/** Daño final con crítico (el número aleatorio se pasa para poder probarlo). */
export function danoFinal(base: number, mult: number, critico: number, multCritico: number, azar: number): { dano: number; critico: boolean } {
  const esCritico = azar < critico;
  return { dano: base * mult * (esCritico ? multCritico : 1), critico: esCritico };
}

/* ---------- Estamina ---------- */

/** Segundos sin gastar estamina antes de que empiece a recuperarse. */
export const PAUSA_ESTAMINA = 0.6;
/** Con el escudo levantado se recupera a este ritmo. */
export const REGEN_BLOQUEANDO = 0.35;
/** Bloquear un golpe gasta su daño multiplicado por esto (menos con un buen escudo). */
export const ESTAMINA_POR_BLOQUEO = 1.4;

/** Estamina tras `dt` segundos: se recupera solo si pasó la pausa desde el último gasto. */
export function regenerarEstamina(actual: number, max: number, regen: number, desdeGasto: number, bloqueando: boolean, dt: number): number {
  if (desdeGasto < PAUSA_ESTAMINA) return actual;
  return Math.min(max, actual + regen * (bloqueando ? REGEN_BLOQUEANDO : 1) * dt);
}

/** Estamina que cuesta parar un golpe con el escudo (un escudo mejor cansa menos). */
export const costeBloqueo = (dano: number, defensaEscudo: number) => dano * ESTAMINA_POR_BLOQUEO * (1.2 - defensaEscudo * 0.6);
