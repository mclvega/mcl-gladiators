import { accionesMando, TECLAS, zonaMuerta, type Accion, type Fuente } from './controles';

/** Teclado: WASD o flechas para moverse y las teclas de `TECLAS` para las acciones. */
export class Teclado {
  private teclas = new Set<string>();

  constructor() {
    addEventListener('keydown', (e) => {
      this.teclas.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    addEventListener('blur', () => this.teclas.clear());
  }

  fuente(extra: Accion[] = []): Fuente {
    const t = this.teclas;
    let x = 0;
    let y = 0;
    if (t.has('ArrowLeft') || t.has('KeyA')) x -= 1;
    if (t.has('ArrowRight') || t.has('KeyD')) x += 1;
    if (t.has('ArrowUp') || t.has('KeyW')) y -= 1;
    if (t.has('ArrowDown') || t.has('KeyS')) y += 1;
    const activas = (Object.keys(TECLAS) as Accion[]).filter((a) => TECLAS[a].some((k) => t.has(k)));
    return { x, y, camX: 0, camY: 0, activas: [...activas, ...extra] };
  }

  limpiar() {
    this.teclas.clear();
  }
}

export type Navegar = 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'aceptar' | 'atras' | 'start';

/**
 * Mando físico (Gamepad API): Xbox, PlayStation o genéricos, por USB o Bluetooth, también en el móvil.
 * Stick izquierdo o cruceta para moverse, stick derecho para la cámara.
 */
export class Mando {
  /** Se usó el mando hace poco (se ocultan los controles táctiles). */
  usado = false;
  private anteriores: boolean[] = [];
  private repetir = 0;
  private dirAnterior = '';

  constructor(alConectar: (nombre: string, conectado: boolean) => void) {
    addEventListener('gamepadconnected', (e) => alConectar(e.gamepad.id, true));
    addEventListener('gamepaddisconnected', (e) => {
      this.usado = false;
      alConectar(e.gamepad.id, false);
    });
  }

  private actual(): Gamepad | null {
    try {
      return navigator.getGamepads?.().find((m) => m && m.connected) ?? null;
    } catch {
      return null;
    }
  }

  fuente(): Fuente {
    const m = this.actual();
    if (!m) return { x: 0, y: 0, camX: 0, camY: 0, activas: [] };
    const b = (i: number) => !!m.buttons[i]?.pressed;
    let [x, y] = zonaMuerta(m.axes[0] ?? 0, m.axes[1] ?? 0);
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    const [camX, camY] = zonaMuerta(m.axes[2] ?? 0, m.axes[3] ?? 0);
    const activas = accionesMando(b);
    if (x || y || camX || camY || activas.length) this.usado = true;
    return { x, y, camX, camY, activas };
  }

  /**
   * Eventos para recorrer los menús: cruceta o stick (con repetición al mantener), A acepta, B vuelve.
   * Se llama una vez por paso (`dt` en segundos).
   */
  navegar(dt: number): Navegar[] {
    const m = this.actual();
    if (!m) return [];
    const b = (i: number) => !!m.buttons[i]?.pressed;
    const nuevo = (i: number) => b(i) && !this.anteriores[i];
    const eventos: Navegar[] = [];
    if (nuevo(0)) eventos.push('aceptar');
    if (nuevo(1)) eventos.push('atras');
    if (nuevo(9)) eventos.push('start');
    const ax = m.axes[0] ?? 0;
    const ay = m.axes[1] ?? 0;
    const dir = b(12) || ay < -0.6 ? 'arriba' : b(13) || ay > 0.6 ? 'abajo' : b(14) || ax < -0.6 ? 'izquierda' : b(15) || ax > 0.6 ? 'derecha' : '';
    if (dir && dir !== this.dirAnterior) {
      eventos.push(dir as Navegar);
      this.repetir = 0.4;
    } else if (dir) {
      this.repetir -= dt;
      if (this.repetir <= 0) {
        eventos.push(dir as Navegar);
        this.repetir = 0.12;
      }
    }
    this.dirAnterior = dir;
    this.anteriores = m.buttons.map((x) => x.pressed);
    if (eventos.length) this.usado = true;
    return eventos;
  }

  /** Vibración del mando, si la tiene. */
  vibrar(ms: number, fuerza = 0.6) {
    const m = this.actual() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null;
    m?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: fuerza, weakMagnitude: fuerza * 0.6 })?.catch(() => undefined);
  }
}
