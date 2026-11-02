import type { Accion, Fuente } from '../core/controles';
import { h } from './dom';

/**
 * Controles táctiles «completos» para el celular: joystick flotante en la mitad izquierda
 * y botones grandes en abanico alrededor del pulgar derecho. Multitáctil: se puede bloquear y moverse a la vez.
 * La cámara se gira arrastrando en la mitad derecha (la zona de `main.ts`, debajo de los botones).
 */
const BOTONES: Array<{ accion: Exclude<Accion, 'pausa'>; icono: string; texto: string }> = [
  { accion: 'ligero', icono: '⚔️', texto: 'Ligero' },
  { accion: 'fuerte', icono: '💥', texto: 'Fuerte' },
  { accion: 'esquiva', icono: '💨', texto: 'Esquivar' },
  { accion: 'bloqueo', icono: '🛡️', texto: 'Escudo' },
  { accion: 'fijar', icono: '🎯', texto: 'Fijar' },
  { accion: 'gloria', icono: '🔥', texto: 'Gloria' },
];

export class ControlesCompletos {
  readonly raiz: HTMLElement;
  private toque = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private base: HTMLElement;
  private perilla: HTMLElement;
  private pulsados = new Set<Accion>();
  private botones = new Map<Accion, HTMLElement>();

  constructor(contenedor: HTMLElement) {
    this.raiz = h('div', { class: 'tc' });
    const zona = h('div', { class: 'tc-zona' });
    this.perilla = h('div', { class: 'tc-perilla' });
    this.base = h('div', { class: 'tc-joystick' }, this.perilla);
    zona.append(this.base);
    zona.addEventListener('pointerdown', (e) => {
      if (this.toque.id !== -1) return;
      zona.setPointerCapture(e.pointerId);
      this.toque = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('visible');
    });
    zona.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.toque.id) return;
      this.toque.x = e.clientX;
      this.toque.y = e.clientY;
    });
    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== this.toque.id) return;
      this.toque.id = -1;
      this.base.classList.remove('visible');
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
    this.raiz.append(zona);

    for (const b of BOTONES) {
      const el = h('div', { class: `tc-boton tc-${b.accion}`, role: 'button', 'aria-label': b.texto },
        h('span', { class: 'tc-icono', text: b.icono }),
        h('small', { text: b.texto }),
      );
      const fin = (e: PointerEvent) => {
        e.preventDefault();
        this.pulsados.delete(b.accion);
        el.classList.remove('activo');
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.pulsados.add(b.accion);
        el.classList.add('activo');
      });
      el.addEventListener('pointerup', fin);
      el.addEventListener('pointercancel', fin);
      el.addEventListener('pointerleave', fin);
      this.botones.set(b.accion, el);
      this.raiz.append(el);
    }
    contenedor.append(this.raiz);
  }

  /** Marca un botón como listo (la gloria cuando el público está entregado). */
  resaltar(accion: Accion, si: boolean) {
    this.botones.get(accion)?.classList.toggle('listo', si);
  }

  fuente(): Fuente {
    let x = 0;
    let y = 0;
    if (this.toque.id !== -1) {
      const radio = 50;
      let dx = this.toque.x - this.toque.ox;
      let dy = this.toque.y - this.toque.oy;
      const l = Math.hypot(dx, dy);
      if (l > radio) {
        dx = (dx / l) * radio;
        dy = (dy / l) * radio;
      }
      this.perilla.style.transform = `translate(${dx}px, ${dy}px)`;
      if (l > 8) {
        x = dx / radio;
        y = dy / radio;
      }
    }
    return { x, y, camX: 0, camY: 0, activas: this.pulsados };
  }

  limpiar() {
    this.pulsados.clear();
    this.toque.id = -1;
    this.base.classList.remove('visible');
    for (const el of this.botones.values()) el.classList.remove('activo');
  }
}
