/**
 * Fachada de los controles: las acciones se definen una vez y las alimentan el teclado, el mando físico
 * y los dos modos táctiles (PSP y completo). La lógica solo pregunta `activo()` y `pulsado()`.
 */

export type Accion = 'ligero' | 'fuerte' | 'bloqueo' | 'esquiva' | 'fijar' | 'gloria' | 'pausa';

export const ACCIONES: Accion[] = ['ligero', 'fuerte', 'bloqueo', 'esquiva', 'fijar', 'gloria', 'pausa'];

/**
 * Botones del mando con la distribución estándar de la Gamepad API:
 * 0 A/✕, 1 B/○, 2 X/□, 3 Y/△, 4 LB/L1, 5 RB/R1, 6 LT/L2, 7 RT/R2, 8 Select, 9 Start, 12-15 cruceta.
 */
export const BOTONES_MANDO: Record<Accion, number[]> = {
  esquiva: [0],
  gloria: [1],
  ligero: [2],
  fuerte: [3, 7],
  fijar: [4],
  bloqueo: [5, 6],
  pausa: [9],
};

export const TECLAS: Record<Accion, string[]> = {
  ligero: ['KeyJ'],
  fuerte: ['KeyK'],
  bloqueo: ['ShiftLeft', 'ShiftRight', 'KeyL'],
  esquiva: ['Space'],
  fijar: ['KeyQ', 'Tab'],
  gloria: ['KeyE'],
  pausa: ['KeyP', 'Escape'],
};

/** Lo que aporta cada fuente en un paso: dirección, cámara y acciones mantenidas. */
export interface Fuente {
  x: number;
  y: number;
  camX: number;
  camY: number;
  activas: Iterable<Accion>;
}

export const fuenteVacia = (): Fuente => ({ x: 0, y: 0, camX: 0, camY: 0, activas: [] });

/** Acciones del mando según qué botones están pulsados. */
export function accionesMando(pulsados: (i: number) => boolean): Accion[] {
  return ACCIONES.filter((a) => BOTONES_MANDO[a].some(pulsados));
}

/** Dirección de un stick con zona muerta (si no llega, cuenta como 0). */
export function zonaMuerta(x: number, y: number, umbral = 0.22): [number, number] {
  const l = Math.hypot(x, y);
  if (l < umbral) return [0, 0];
  // Se reescala para que justo pasado el umbral empiece en 0 y no a saltos.
  const k = Math.min(1, (l - umbral) / (1 - umbral)) / l;
  return [x * k, y * k];
}

export class Controles {
  x = 0;
  y = 0;
  camX = 0;
  camY = 0;
  private actuales = new Set<Accion>();
  private anteriores = new Set<Accion>();

  /** Combina las fuentes: la primera con dirección manda; las acciones se suman. */
  actualizar(fuentes: Fuente[]) {
    this.x = this.y = this.camX = this.camY = 0;
    for (const f of fuentes) {
      if (!this.x && !this.y && (f.x || f.y)) {
        this.x = f.x;
        this.y = f.y;
      }
      this.camX += f.camX;
      this.camY += f.camY;
    }
    const l = Math.hypot(this.x, this.y);
    if (l > 1) {
      this.x /= l;
      this.y /= l;
    }
    this.anteriores = this.actuales;
    this.actuales = new Set();
    for (const f of fuentes) for (const a of f.activas) this.actuales.add(a);
  }

  activo(a: Accion): boolean {
    return this.actuales.has(a);
  }

  pulsado(a: Accion): boolean {
    return this.actuales.has(a) && !this.anteriores.has(a);
  }

  soltado(a: Accion): boolean {
    return !this.actuales.has(a) && this.anteriores.has(a);
  }

  limpiar() {
    this.actuales.clear();
    this.anteriores.clear();
    this.x = this.y = this.camX = this.camY = 0;
  }
}
