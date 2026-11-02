import { generarArena, temaDe, type Arena, type Tema } from '../core/arena';
import { ARMAS, GOLPE_GLORIA, type Golpe } from '../core/armas';
import { angulo, costeBloqueo, danoFinal, defensa, enArco, regenerarEstamina, yawHacia } from '../core/combate';
import { premioCombate, type Combate, type RivalPlan } from '../core/combates';
import { escalaCombate, type Modo } from '../core/difficulty';
import { danoConArmadura, NOMBRE_RANURA, zonaGolpeada, type ArmaEquipada, type Equipo } from '../core/equipo';
import { moverCuerpo, Rejilla, type Cuerpo } from '../core/fisica';
import { Navegacion, type Punto } from '../core/navegacion';
import type { Stats } from '../core/progreso';
import { crearRng, type Rng } from '../core/rng';
import { RIVALES, type ColorAtaque, type DatosRival, type DefAtaque, type TipoRival } from '../core/rivales';
import { actualizarRival } from './ia';

export interface Controles {
  /** Movimiento relativo a la cámara: x = lateral, z = adelante (-1) / atrás (+1). */
  x: number;
  z: number;
  giroX: number;
  giroY: number;
  /** Recién pulsados. */
  ligero: boolean;
  esquivar: boolean;
  fijar: boolean;
  gloria: boolean;
  /** Mantenidos: el fuerte se carga mientras se mantiene y el escudo se sostiene. */
  fuerte: boolean;
  bloquear: boolean;
}

export const controlesVacios = (): Controles => ({ x: 0, z: 0, giroX: 0, giroY: 0, ligero: false, esquivar: false, fijar: false, gloria: false, fuerte: false, bloquear: false });

export type EstadoJugador = 'libre' | 'atacando' | 'cargando' | 'esquivando' | 'tambaleo' | 'guardiaRota' | 'atrapado' | 'rematando' | 'muerto';

export interface Jugador {
  cuerpo: Cuerpo;
  yaw: number;
  vida: number;
  estamina: number;
  /** Segundos desde el último gasto de estamina. */
  desdeGasto: number;
  /** Fervor del público (0 a 100): al llenarse permite el golpe de gloria. */
  fervor: number;
  estado: EstadoJugador;
  t: number;
  golpe: Golpe | null;
  golpeHecho: boolean;
  /** Multiplicador de daño del golpe en curso (carga del fuerte). */
  carga: number;
  combo: number;
  comboT: number;
  cola: 'ligero' | 'fuerte' | null;
  esquivaX: number;
  esquivaZ: number;
  invul: number;
  bloqueando: boolean;
  bloqueoT: number;
  /** Ventana de contraataque tras un bloqueo perfecto. */
  contraT: number;
  moviendose: boolean;
  rematando: Rival | null;
  /** Cambia con cada ataque (los rivales listos reaccionan una vez por ataque). */
  ataqueId: number;
  /** Último tipo de acción ofensiva (variar sube más el fervor). */
  ultimaAccion: string;
}

export type EstadoRival = 'aparecer' | 'mover' | 'aviso' | 'embestida' | 'recuperar' | 'aturdido' | 'tambaleo' | 'esquivando' | 'atrapado' | 'muerto';

export interface Rival {
  id: number;
  tipo: TipoRival;
  d: DatosRival;
  cuerpo: Cuerpo;
  yaw: number;
  vida: number;
  vidaMax: number;
  aturd: number;
  aturdMax: number;
  estado: EstadoRival;
  t: number;
  ataque: DefAtaque | null;
  recargas: Record<string, number>;
  embX: number;
  embZ: number;
  golpeoEmbestida: boolean;
  campeon: boolean;
  firme: boolean;
  /** Multiplicador de su daño (dificultad, combate y campeón). */
  mult: number;
  velocidad: number;
  ruta: Punto[];
  rutaT: number;
  rodeo: number;
  muerteT: number;
  /** Último ataque del jugador al que reaccionó. */
  reaccion: number;
}

export interface Proyectil {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  dano: number;
  radio: number;
  color: ColorAtaque;
  delJugador: boolean;
  vida: number;
  tipo: 'flecha' | 'red';
  origen: Rival | null;
}

/** Ataque de área avisado en el suelo: estalla cuando `t` llega a 0. */
export interface Area {
  x: number;
  z: number;
  r: number;
  t: number;
  total: number;
  dano: number;
  color: ColorAtaque;
  origen: Rival | null;
}

export type TipoEfecto = 'chispa' | 'sangre' | 'onda' | 'parry' | 'remate' | 'polvo' | 'gloria';

export interface Efecto {
  tipo: TipoEfecto;
  x: number;
  y: number;
  z: number;
  /** Radio (ondas). */
  r: number;
  t: number;
  total: number;
}

export interface NumeroDano {
  x: number;
  y: number;
  z: number;
  valor: number;
  t: number;
  critico: boolean;
  propio: boolean;
}

export type Fase = 'combate' | 'victoria' | 'derrota' | 'fin';

export interface Resumen {
  victoria: boolean;
  bajas: number;
  perfectos: number;
  fervorMedio: number;
  tiempo: number;
  oro: number;
  fama: number;
  campeon: boolean;
  /** Piezas que se rompieron en el combate. */
  rotas: string[];
}

export interface EventosPartida {
  acierto?: (critico: boolean) => void;
  dano?: (fuerte: boolean) => void;
  parry?: () => void;
  bloqueo?: () => void;
  guardiaRota?: () => void;
  baja?: (r: Rival) => void;
  remate?: () => void;
  gloria?: () => void;
  red?: () => void;
  rotura?: (nombre: string) => void;
  oleada?: () => void;
  fin?: (r: Resumen) => void;
}

export interface OpcionesPartida {
  modo: Modo;
  combate: Combate;
  stats: Stats;
  /** Equipo del jugador: se desgasta durante el combate (es el mismo objeto del guardado). */
  equipo: Equipo;
  arma: ArmaEquipada;
  semilla?: number;
  eventos?: EventosPartida;
}

const ESQUIVA_VEL = 11;
const ESQUIVA_DUR = 0.36;
const CARGA_MAX = 1;
const ALCANCE_REMATE = 2.8;
const MULT_CRITICO = 1.8;
let siguienteVersion = 1;

export class Partida {
  readonly modo: Modo;
  readonly combate: Combate;
  readonly stats: Stats;
  readonly equipo: Equipo;
  readonly arma: ArmaEquipada;
  readonly tema: Tema;
  /** Cada partida tiene la suya: el render reconstruye la arena al cambiar. */
  readonly version = siguienteVersion++;
  rng: Rng;
  private eventos: EventosPartida;

  fase: Fase = 'combate';
  tiempo = 0;
  pausada = false;
  arena: Arena;
  rejilla: Rejilla;
  nav: Navegacion;
  /** De 0 a 1: los rivales esquivan más y avisan menos. */
  readonly ia: number;

  jugador: Jugador;
  rivales: Rival[] = [];
  proyectiles: Proyectil[] = [];
  areas: Area[] = [];
  efectos: Efecto[] = [];
  numeros: NumeroDano[] = [];
  fijado: Rival | null = null;
  autoFijar = false;
  ayudaEsquiva = false;
  lento = false;
  camYaw = 0;
  camPitch = 0.42;

  bajas = 0;
  perfectos = 0;
  oleada = 0;
  mensaje = '';
  mensajeT = 0;
  /** Parpadeo de la barra de estamina al intentar algo sin aliento. */
  sinAliento = 0;
  resumen: Resumen | null = null;
  private fervorSuma = 0;
  private finT = 0;
  private rotas: string[] = [];
  private siguienteId = 1;

  constructor(o: OpcionesPartida) {
    this.modo = o.modo;
    this.combate = o.combate;
    this.stats = o.stats;
    this.equipo = o.equipo;
    this.arma = o.arma;
    const semilla = o.semilla ?? Date.now();
    this.rng = crearRng(semilla);
    this.eventos = o.eventos ?? {};
    this.tema = temaDe(o.combate.n);
    this.ia = escalaCombate(o.combate.n).ia;
    this.arena = generarArena(o.combate.n * 53 + (semilla % 1000), o.combate.n, o.combate.regla === 'campeon');
    this.rejilla = new Rejilla(this.arena.bloques);
    this.nav = new Navegacion(this.arena.bloques, this.arena.radio);
    this.jugador = {
      cuerpo: { x: this.arena.inicio.x, y: 0, z: this.arena.inicio.z, vy: 0, radio: 0.4, alto: 1.8, enSuelo: true },
      yaw: 0, vida: this.stats.vidaMax, estamina: this.stats.estaminaMax, desdeGasto: 9, fervor: 0, estado: 'libre', t: 0, golpe: null, golpeHecho: false, carga: 1,
      combo: 0, comboT: 9, cola: null, esquivaX: 0, esquivaZ: 0, invul: 0, bloqueando: false, bloqueoT: 9, contraT: 0, moviendose: false, rematando: null, ataqueId: 0, ultimaAccion: '',
    };
    const c = o.combate;
    this.mensaje = c.campeon ? `👑 ${c.campeon}` : '';
    this.mensajeT = c.campeon ? 3 : 0;
    this.sacarOleada();
  }

  /* ---------- Rivales y oleadas ---------- */

  private sacarOleada() {
    const lista = this.combate.oleadas[this.oleada++] ?? [];
    const puntos = [...this.arena.apariciones];
    lista.forEach((plan, i) => {
      const p = puntos.splice(this.rng.entero(0, puntos.length - 1), 1)[0] ?? this.arena.apariciones[i % this.arena.apariciones.length] ?? { x: 0, z: -this.arena.radio * 0.5 };
      this.crearRival(plan, p.x, p.z);
    });
    if (this.oleada > 1) {
      this.mensaje = `🌊 Oleada ${this.oleada} de ${this.combate.oleadas.length}`;
      this.mensajeT = 2;
      this.eventos.oleada?.();
    }
  }

  crearRival(plan: RivalPlan, x: number, z: number): Rival {
    const d = RIVALES[plan.tipo];
    const esc = escalaCombate(this.combate.n);
    const vida = d.vida * this.modo.vida * esc.vida * (plan.campeon ? 2.8 : 1);
    const r: Rival = {
      id: this.siguienteId++, tipo: plan.tipo, d, cuerpo: { x, y: 0, z, vy: 0, radio: d.radio, alto: 1.8 * d.escala, enSuelo: true },
      yaw: yawHacia(x, z, this.jugador.cuerpo.x, this.jugador.cuerpo.z), vida, vidaMax: vida, aturd: 0, aturdMax: d.aturdMax * (plan.campeon ? 2 : 1) * (1 + esc.ia * 0.5),
      estado: 'aparecer', t: 0.9, ataque: null, recargas: {}, embX: 0, embZ: 0, golpeoEmbestida: false, campeon: plan.campeon, firme: !!d.firme || plan.campeon,
      mult: this.modo.dano * esc.dano * (plan.campeon ? 1.25 : 1), velocidad: d.velocidad * (plan.campeon ? 1.1 : 1),
      ruta: [], rutaT: 0, rodeo: this.rng.siguiente() < 0.5 ? 1 : -1, muerteT: 0, reaccion: 0,
    };
    for (const a of d.ataques) r.recargas[a.nombre] = this.rng.rango(0.3, 1.5);
    this.rivales.push(r);
    return r;
  }

  get vivos(): Rival[] {
    return this.rivales.filter((r) => r.estado !== 'muerto');
  }

  /** Duración del aviso de un ataque: los rivales de más adelante y los campeones avisan menos. */
  avisoDe(r: Rival, a: DefAtaque) {
    return a.aviso * (1 - this.ia * 0.25) * (r.campeon ? 0.85 : 1);
  }

  /* ---------- Bucle ---------- */

  actualizar(dt: number, c: Controles) {
    if (this.pausada) return;
    for (const n of this.numeros) n.t -= dt;
    this.numeros = this.numeros.filter((n) => n.t > 0);
    for (const e of this.efectos) e.t -= dt;
    this.efectos = this.efectos.filter((e) => e.t > 0);
    this.mensajeT = Math.max(0, this.mensajeT - dt);
    this.sinAliento = Math.max(0, this.sinAliento - dt);
    if (this.fase === 'fin') return;
    this.tiempo += dt;
    if (this.fase !== 'combate') {
      // Unos segundos de celebración (o de caída) antes del resumen.
      for (const r of this.rivales) if (r.estado === 'muerto') r.muerteT += dt;
      this.finT -= dt;
      if (this.finT <= 0) this.terminar(this.fase === 'victoria');
      return;
    }
    this.fervorSuma += this.jugador.fervor * dt;

    // Ayuda de esquiva: el mundo va más lento justo antes de un ataque rojo que te va a dar.
    this.lento = this.ayudaEsquiva && this.peligroRojo();
    const dtm = this.lento ? dt * 0.4 : dt;

    this.actualizarCamara(dt, c);
    this.actualizarJugador(dt, c);
    for (const r of this.rivales) {
      if (r.estado === 'muerto') r.muerteT += dt;
      else actualizarRival(this, r, dtm);
    }
    this.rivales = this.rivales.filter((r) => r.estado !== 'muerto' || r.muerteT < 1.6);
    this.separarRivales();
    this.actualizarProyectiles(dtm);
    this.actualizarAreas(dtm);
    this.actualizarTrampas(dt);

    if (this.fase !== 'combate') return;
    const vivos = this.vivos.length;
    const ultima = this.oleada >= this.combate.oleadas.length;
    if (!ultima && vivos <= (this.combate.regla === 'oleadas' ? 1 : 0)) this.sacarOleada();
    else if (ultima && vivos === 0) {
      this.fase = 'victoria';
      this.finT = 2.2;
      this.mensaje = '🏆 ¡Victoria!';
      this.mensajeT = 2.2;
    }
  }

  private peligroRojo(): boolean {
    const j = this.jugador.cuerpo;
    for (const r of this.rivales) {
      const a = r.ataque;
      if (r.estado !== 'aviso' || !a || a.color !== 'rojo' || a.tipo === 'zarpazo') continue;
      const falta = this.avisoDe(r, a) - r.t;
      if (falta < 0.3 && Math.hypot(r.cuerpo.x - j.x, r.cuerpo.z - j.z) < a.alcance + (a.radio ?? 0) + 1.5) return true;
    }
    return this.areas.some((a) => a.color === 'rojo' && a.t < 0.3 && Math.hypot(a.x - j.x, a.z - j.z) < a.r + 0.5);
  }

  private actualizarCamara(dt: number, c: Controles) {
    this.camYaw -= c.giroX;
    this.camPitch = Math.max(0.15, Math.min(0.95, this.camPitch + c.giroY * 0.6));
    if (this.fijado && this.fijado.estado === 'muerto') this.fijado = null;
    if (this.autoFijar && !this.fijado) this.fijado = this.masCercano(10);
    const f = this.fijado;
    if (f) {
      const j = this.jugador.cuerpo;
      this.camYaw += angulo(yawHacia(j.x, j.z, f.cuerpo.x, f.cuerpo.z) - this.camYaw) * Math.min(1, dt * 4);
    }
  }

  masCercano(max: number, desdeYaw?: number): Rival | null {
    const j = this.jugador.cuerpo;
    let mejor: Rival | null = null;
    let d = max;
    for (const r of this.vivos) {
      if (r.estado === 'aparecer') continue;
      let dist = Math.hypot(r.cuerpo.x - j.x, r.cuerpo.z - j.z);
      // Se prefieren los que están delante.
      if (desdeYaw !== undefined) dist += Math.abs(angulo(yawHacia(j.x, j.z, r.cuerpo.x, r.cuerpo.z) - desdeYaw)) * 1.5;
      if (dist < d) {
        d = dist;
        mejor = r;
      }
    }
    return mejor;
  }

  /* ---------- Jugador ---------- */

  /** Gasta estamina si hay suficiente (al menos la mitad del coste); si no, avisa. */
  private gastar(coste: number): boolean {
    const j = this.jugador;
    if (j.estamina < coste * 0.5) {
      this.sinAliento = 0.5;
      return false;
    }
    j.estamina = Math.max(0, j.estamina - coste);
    j.desdeGasto = 0;
    return true;
  }

  private empezarGolpe(g: Golpe, carga = 1, accion = 'ligero') {
    const j = this.jugador;
    j.estado = 'atacando';
    j.golpe = g;
    j.t = 0;
    j.golpeHecho = false;
    j.carga = carga;
    j.cola = null;
    j.bloqueando = false;
    j.ataqueId++;
    // Variar de golpe gusta al público.
    if (accion !== j.ultimaAccion) this.subirFervor(2);
    j.ultimaAccion = accion;
    const obj = this.fijado ?? this.masCercano(6, j.yaw);
    if (obj) j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, obj.cuerpo.x, obj.cuerpo.z);
  }

  private ataqueLigero() {
    const j = this.jugador;
    const lista = ARMAS[this.arma.id].ligero;
    if (j.comboT > 0.55) j.combo = 0;
    const g = lista[j.combo % lista.length];
    if (!this.gastar(g.estamina)) return;
    j.combo = (j.combo + 1) % lista.length;
    this.empezarGolpe(g, 1, `ligero${j.combo}`);
  }

  private soltarFuerte() {
    const j = this.jugador;
    const carga = Math.min(1, j.t / CARGA_MAX);
    const g = ARMAS[this.arma.id].fuerte;
    j.estado = 'libre';
    if (!this.gastar(g.estamina * (1 + carga * 0.4))) return;
    j.combo = 0;
    if (ARMAS[this.arma.id].efecto === 'red') return this.lanzarRed(carga);
    this.empezarGolpe(g, 1 + carga * 0.8, 'fuerte');
  }

  private lanzarRed(carga: number) {
    const j = this.jugador;
    const obj = this.fijado ?? this.masCercano(12, j.yaw);
    const yaw = obj ? yawHacia(j.cuerpo.x, j.cuerpo.z, obj.cuerpo.x, obj.cuerpo.z) : j.yaw;
    j.yaw = yaw;
    j.ataqueId++;
    const v = 14 + carga * 6;
    this.proyectiles.push({
      x: j.cuerpo.x - Math.sin(yaw) * 0.7, y: 1.2, z: j.cuerpo.z - Math.cos(yaw) * 0.7, vx: -Math.sin(yaw) * v, vz: -Math.cos(yaw) * v,
      dano: ARMAS.tridente.fuerte.dano, radio: 0.7, color: 'amarillo', delJugador: true, vida: 0.7 + carga * 0.3, tipo: 'red', origen: null,
    });
    j.estado = 'tambaleo';
    j.t = 0.3;
    this.eventos.red?.();
  }

  private actualizarJugador(dt: number, c: Controles) {
    const j = this.jugador;
    if (j.estado === 'muerto') return;
    const s = this.stats;
    j.invul = Math.max(0, j.invul - dt);
    j.contraT = Math.max(0, j.contraT - dt);
    j.comboT += dt;
    j.desdeGasto += dt;
    j.estamina = regenerarEstamina(j.estamina, s.estaminaMax, s.regen, j.desdeGasto, j.bloqueando, dt);

    if (c.fijar) this.fijado = this.fijado ? null : this.masCercano(16, this.camYaw);

    // Dirección de movimiento según la cámara.
    const largo = Math.hypot(c.x, c.z);
    const mx = largo > 1 ? c.x / largo : c.x;
    const mz = largo > 1 ? c.z / largo : c.z;
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    const dx = mx * cos + mz * sin;
    const dz = -mx * sin + mz * cos;
    j.moviendose = false;

    const puedeEsquivar = j.estado === 'libre' || j.estado === 'cargando' || (j.estado === 'atacando' && j.golpeHecho && j.golpe !== GOLPE_GLORIA);
    if (c.esquivar && puedeEsquivar && this.gastar(s.costeEsquiva)) {
      j.estado = 'esquivando';
      j.t = 0;
      j.bloqueando = false;
      const l = Math.hypot(dx, dz);
      if (l > 0.1) {
        j.esquivaX = dx / l;
        j.esquivaZ = dz / l;
      } else {
        // Sin dirección: hacia atrás.
        j.esquivaX = Math.sin(j.yaw);
        j.esquivaZ = Math.cos(j.yaw);
      }
      j.invul = 0.3;
    }

    switch (j.estado) {
      case 'tambaleo':
      case 'guardiaRota':
      case 'atrapado':
        j.t -= dt;
        if (j.t <= 0) j.estado = 'libre';
        if (j.estado !== 'atrapado') this.mover(0, 0, dt);
        return;
      case 'rematando':
        j.t -= dt;
        j.invul = 0.2;
        if (j.t <= 0) this.terminarRemate();
        return;
      case 'esquivando':
        j.t += dt;
        this.mover(j.esquivaX * ESQUIVA_VEL, j.esquivaZ * ESQUIVA_VEL, dt);
        if (j.t >= ESQUIVA_DUR) j.estado = 'libre';
        return;
      case 'cargando': {
        j.t += dt;
        // Se puede girar un poco mientras se carga.
        const f = this.fijado;
        if (f) j.yaw += angulo(yawHacia(j.cuerpo.x, j.cuerpo.z, f.cuerpo.x, f.cuerpo.z) - j.yaw) * Math.min(1, dt * 8);
        else if (Math.hypot(dx, dz) > 0.1) j.yaw += angulo(Math.atan2(-dx, -dz) - j.yaw) * Math.min(1, dt * 6);
        this.mover(dx * s.velocidad * 0.25, dz * s.velocidad * 0.25, dt);
        if (!c.fuerte || j.t >= CARGA_MAX) this.soltarFuerte();
        return;
      }
      case 'atacando': {
        const g = j.golpe!;
        j.t += dt * (g === GOLPE_GLORIA ? 1 : s.rapidez);
        const fr = j.t / g.duracion;
        if (fr < g.impacto) this.mover(-Math.sin(j.yaw) * g.avance * 3, -Math.cos(j.yaw) * g.avance * 3, dt);
        if (!j.golpeHecho && fr >= g.impacto) {
          j.golpeHecho = true;
          this.aplicarGolpe(g);
        }
        if (fr > 0.3 && c.ligero) j.cola = 'ligero';
        if (fr > 0.3 && c.fuerte && !j.cola) j.cola = 'fuerte';
        if (fr >= 1) {
          j.estado = 'libre';
          j.comboT = 0;
          const cola = j.cola;
          j.cola = null;
          if (cola === 'ligero') this.ataqueLigero();
          else if (cola === 'fuerte' && c.fuerte) {
            j.estado = 'cargando';
            j.t = 0;
          }
        }
        return;
      }
    }

    // Libre: moverse, cubrirse y empezar acciones.
    const levantado = c.bloquear;
    if (levantado && !j.bloqueando) j.bloqueoT = 0;
    j.bloqueando = levantado;
    if (j.bloqueando) j.bloqueoT += dt;

    const vel = s.velocidad * (j.bloqueando ? 0.45 : 1);
    if (Math.hypot(dx, dz) > 0.1) {
      j.moviendose = true;
      if (!j.bloqueando) j.yaw += angulo(Math.atan2(-dx, -dz) - j.yaw) * Math.min(1, dt * 14);
    }
    if (j.bloqueando) {
      const f = this.fijado;
      const objetivo = f ? yawHacia(j.cuerpo.x, j.cuerpo.z, f.cuerpo.x, f.cuerpo.z) : this.camYaw;
      j.yaw += angulo(objetivo - j.yaw) * Math.min(1, dt * 12);
    }
    this.mover(dx * vel, dz * vel, dt);

    if (j.bloqueando) return;
    if ((c.ligero || c.fuerte) && this.rematable()) {
      if (this.rematar()) return;
    }
    if (c.gloria && j.fervor >= 100) return this.golpeGloria();
    if (c.ligero) return this.ataqueLigero();
    if (c.fuerte) {
      j.estado = 'cargando';
      j.t = 0;
    }
  }

  private mover(vx: number, vz: number, dt: number) {
    const c = this.jugador.cuerpo;
    moverCuerpo(c, vx * dt, vz * dt, dt, this.rejilla);
    const r = Math.hypot(c.x, c.z);
    const max = this.arena.radio - 0.5;
    if (r > max) {
      c.x = (c.x / r) * max;
      c.z = (c.z / r) * max;
    }
  }

  /** Rival aturdido (o atrapado en la red) a mano para rematarlo. */
  rematable(): Rival | null {
    const j = this.jugador.cuerpo;
    let mejor: Rival | null = null;
    let d = ALCANCE_REMATE;
    for (const r of this.rivales) {
      if (r.estado !== 'aturdido') continue;
      const dist = Math.hypot(r.cuerpo.x - j.x, r.cuerpo.z - j.z) - r.d.radio;
      if (dist < d) {
        d = dist;
        mejor = r;
      }
    }
    return mejor;
  }

  private rematar(): boolean {
    const r = this.rematable();
    if (!r) return false;
    const j = this.jugador;
    j.estado = 'rematando';
    j.t = 0.75;
    j.rematando = r;
    j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, r.cuerpo.x, r.cuerpo.z);
    r.t = Math.max(r.t, 1);
    return true;
  }

  private terminarRemate() {
    const j = this.jugador;
    const r = j.rematando;
    j.estado = 'libre';
    j.rematando = null;
    if (!r || r.estado === 'muerto') return;
    this.efecto('remate', r.cuerpo.x, 1.2, r.cuerpo.z, 0, 0.6);
    j.estamina = Math.min(this.stats.estaminaMax, j.estamina + 25);
    this.subirFervor(15);
    this.eventos.remate?.();
    // Los campeones pierden un buen trozo de vida; los demás caen.
    const dano = r.campeon ? r.vidaMax * 0.25 : r.vida + 1;
    r.aturd = 0;
    r.estado = 'mover';
    this.herirRival(r, dano, 0, 'directo');
  }

  private golpeGloria() {
    const j = this.jugador;
    this.empezarGolpe(GOLPE_GLORIA, 1, 'gloria');
    j.fervor = 0;
    j.invul = GOLPE_GLORIA.duracion;
    this.efecto('gloria', j.cuerpo.x, 1, j.cuerpo.z, 2, 0.8);
    this.mensaje = '🔥 ¡Golpe de gloria!';
    this.mensajeT = 1.5;
    this.eventos.gloria?.();
  }

  subirFervor(n: number) {
    const j = this.jugador;
    j.fervor = Math.max(0, Math.min(100, j.fervor + n));
  }

  private aplicarGolpe(g: Golpe) {
    const j = this.jugador;
    let alguno = false;
    for (const r of this.vivos) {
      if (r.estado === 'aparecer') continue;
      if (!enArco(j.cuerpo.x, j.cuerpo.z, j.yaw, r.cuerpo.x, r.cuerpo.z, r.d.radio, g.alcance, g.arco)) continue;
      this.herirRival(r, g.dano * j.carga, g.aturd * j.carga, g === GOLPE_GLORIA ? 'gloria' : j.carga > 1.4 ? 'cargado' : 'golpe');
      alguno = true;
    }
    if (g.arco >= Math.PI * 2 - 0.01) this.efecto('onda', j.cuerpo.x, 1, j.cuerpo.z, g.alcance, 0.4);
    if (alguno) this.subirFervor(1 + Math.min(3, j.combo));
    else j.comboT = 0;
  }

  /** Daño a un rival: crítico, escudo (guardia), armadura, aturdimiento y tambaleo. */
  herirRival(r: Rival, base: number, aturd: number, fuente: 'golpe' | 'cargado' | 'gloria' | 'red' | 'trampa' | 'directo') {
    if (r.estado === 'muerto') return;
    const j = this.jugador;
    const efecto = ARMAS[this.arma.id].efecto;
    const directo = fuente === 'trampa' || fuente === 'directo';
    const mult = this.stats.dano * (j.contraT > 0 ? 1.6 : 1);
    let { dano, critico } = directo ? { dano: base, critico: false } : danoFinal(base, mult, this.stats.critico, MULT_CRITICO, this.rng.siguiente());
    if (efecto === 'aturde') aturd *= 1.5;
    // Escudo: de frente para casi todo hasta que se le rompe la guardia (la barra de aturdimiento).
    const indefenso = r.estado === 'aturdido' || r.estado === 'atrapado' || r.estado === 'tambaleo';
    if (r.d.escudo && !indefenso && !directo && fuente !== 'gloria') {
      const deFrente = Math.abs(angulo(yawHacia(r.cuerpo.x, r.cuerpo.z, j.cuerpo.x, j.cuerpo.z) - r.yaw)) < 1.1;
      if (deFrente) {
        dano *= 0.15;
        aturd *= (efecto === 'parteEscudos' ? 2.6 : 1.5) * (fuente === 'cargado' ? 1.6 : 1);
        this.efecto('chispa', r.cuerpo.x, 1.2, r.cuerpo.z, 0, 0.25);
      }
    }
    if (!directo) dano *= 1 - r.d.armadura;
    r.vida -= dano;
    if (fuente !== 'trampa') {
      this.numeros.push({ x: r.cuerpo.x, y: r.cuerpo.alto + 0.4, z: r.cuerpo.z, valor: Math.round(dano), t: 0.8, critico, propio: false });
      this.efecto('sangre', r.cuerpo.x, 1.1, r.cuerpo.z, 0, 0.3);
      this.eventos.acierto?.(critico);
      if (critico) this.subirFervor(3);
    }

    // Aturdimiento: al llenarse la barra, se le puede rematar.
    if (r.estado !== 'aturdido' && aturd > 0) {
      r.aturd += aturd;
      if (r.aturd >= r.aturdMax) {
        r.estado = 'aturdido';
        r.t = r.campeon ? 2.6 : 3.2;
        r.ataque = null;
      }
    }
    // Tambaleo: los ligeros interrumpen a los que no son firmes (menos en ataques rojos); el fuerte cargado, a todos.
    const rojo = r.estado === 'aviso' && r.ataque?.color === 'rojo';
    const interrumpe = fuente === 'cargado' ? !rojo || !r.campeon : !r.firme && !rojo && aturd >= 6;
    if (interrumpe && (r.estado === 'mover' || r.estado === 'aviso' || r.estado === 'recuperar')) {
      r.estado = 'tambaleo';
      r.t = fuente === 'cargado' ? 0.7 : 0.32;
      r.ataque = null;
    }
    if (r.vida <= 0) this.morir(r);
  }

  private morir(r: Rival) {
    r.estado = 'muerto';
    r.muerteT = 0;
    r.vida = 0;
    this.bajas++;
    this.subirFervor(r.campeon ? 30 : 8);
    if (this.fijado === r) this.fijado = null;
    this.eventos.baja?.(r);
  }

  /** Daño de un rival al jugador: esquiva, escudo, bloqueo perfecto, armadura por zonas y tambaleo. */
  golpearJugador(dano: number, color: ColorAtaque, ox: number, oz: number, atacante: Rival | null): 'esquivado' | 'parry' | 'bloqueo' | 'golpe' {
    const j = this.jugador;
    if (j.estado === 'muerto' || j.invul > 0) return 'esquivado';
    const deFrente = Math.abs(angulo(yawHacia(j.cuerpo.x, j.cuerpo.z, ox, oz) - j.yaw)) < 1.75;
    const def = defensa(color, j.bloqueando && j.estado === 'libre', j.bloqueoT, this.modo.parry, deFrente);
    if (def === 'parry') {
      this.efecto('parry', j.cuerpo.x - Math.sin(j.yaw) * 0.6, 1.3, j.cuerpo.z - Math.cos(j.yaw) * 0.6, 0, 0.4);
      j.contraT = 1.2;
      j.estamina = Math.min(this.stats.estaminaMax, j.estamina + 10);
      this.perfectos++;
      this.subirFervor(12);
      if (atacante && atacante.estado !== 'muerto') {
        const extra = color === 'azul' ? 3 : 1.2;
        atacante.aturd += 30 * extra;
        if (atacante.aturd >= atacante.aturdMax) {
          atacante.estado = 'aturdido';
          atacante.t = 3;
        } else {
          atacante.estado = 'tambaleo';
          atacante.t = color === 'azul' ? 1.2 : 0.8;
        }
        atacante.ataque = null;
      }
      this.eventos.parry?.();
      return 'parry';
    }
    if (def === 'bloqueo') {
      const escudo = this.equipo.escudo && this.equipo.escudo.durabilidad > 0 ? this.equipo.escudo : null;
      const para = escudo?.defensa ?? 0.5;
      j.estamina -= costeBloqueo(dano, para);
      j.desdeGasto = 0;
      this.desgastar('escudo', dano * 0.5);
      dano *= 1 - para;
      this.efecto('chispa', j.cuerpo.x - Math.sin(j.yaw) * 0.6, 1.3, j.cuerpo.z - Math.cos(j.yaw) * 0.6, 0, 0.25);
      this.eventos.bloqueo?.();
      if (j.estamina <= 0) {
        // Sin aliento, el escudo cede: un rato sin poder hacer nada.
        j.estamina = 0;
        j.estado = 'guardiaRota';
        j.t = 1.3;
        j.bloqueando = false;
        this.mensaje = '💢 ¡Guardia rota!';
        this.mensajeT = 1.2;
        this.subirFervor(-5);
        this.eventos.guardiaRota?.();
      }
    } else {
      // El golpe cae en una zona del cuerpo y la armadura de esa zona para una parte.
      const zona = zonaGolpeada(this.rng.siguiente());
      const r = danoConArmadura(dano * (j.estado === 'guardiaRota' ? 1.3 : 1), this.equipo[zona]);
      this.desgastar(zona, r.desgaste);
      dano = r.dano;
      this.subirFervor(-6);
    }
    j.vida -= dano;
    this.numeros.push({ x: j.cuerpo.x, y: 2.2, z: j.cuerpo.z, valor: Math.round(dano), t: 0.8, critico: false, propio: true });
    if (def === 'golpe') {
      this.eventos.dano?.(dano >= 12);
      if (dano >= 12 && j.estado !== 'rematando' && j.estado !== 'guardiaRota') {
        j.estado = 'tambaleo';
        j.t = 0.35;
        j.bloqueando = false;
      }
    }
    if (j.vida <= 0) this.caer();
    return def;
  }

  private desgastar(ranura: keyof Equipo, cuanto: number) {
    const p = this.equipo[ranura];
    if (!p || p.durabilidad <= 0 || cuanto <= 0) return;
    p.durabilidad = Math.max(0, p.durabilidad - cuanto);
    if (p.durabilidad <= 0) {
      this.rotas.push(p.nombre);
      this.mensaje = `💔 ${NOMBRE_RANURA[ranura].nombre} roto`;
      this.mensajeT = 1.6;
      this.eventos.rotura?.(p.nombre);
    }
  }

  private caer() {
    const j = this.jugador;
    j.vida = 0;
    j.estado = 'muerto';
    this.fase = 'derrota';
    this.finT = 1.8;
    this.mensaje = '💀 Has caído';
    this.mensajeT = 1.8;
  }

  /** Rendirse desde la pausa: cuenta como derrota. */
  abandonar() {
    this.terminar(false);
  }

  private terminar(victoria: boolean) {
    if (this.fase === 'fin') return;
    this.fase = 'fin';
    const fervorMedio = this.tiempo > 0 ? this.fervorSuma / this.tiempo : 0;
    const premio = victoria ? premioCombate(this.combate.n, this.combate.regla, fervorMedio, this.modo.oro) : { oro: 0, fama: 0 };
    this.resumen = {
      victoria, bajas: this.bajas, perfectos: this.perfectos, fervorMedio: Math.round(fervorMedio), tiempo: Math.round(this.tiempo),
      oro: premio.oro, fama: premio.fama, campeon: victoria && this.combate.regla === 'campeon', rotas: this.rotas,
    };
    this.eventos.fin?.(this.resumen);
  }

  /* ---------- Proyectiles, áreas y trampas ---------- */

  private actualizarProyectiles(dt: number) {
    const j = this.jugador;
    for (const p of this.proyectiles) {
      p.vida -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.delJugador) {
        for (const r of this.vivos) {
          if (r.estado === 'aparecer') continue;
          if (Math.hypot(r.cuerpo.x - p.x, r.cuerpo.z - p.z) >= r.d.radio + p.radio) continue;
          if (p.tipo === 'red') {
            this.herirRival(r, p.dano, 10, 'red');
            if (r.estado !== 'muerto' && r.estado !== 'aturdido') {
              r.estado = 'atrapado';
              r.t = r.campeon || r.d.fiera ? 1.6 : 2.6;
              r.ataque = null;
              this.subirFervor(6);
            }
          } else this.herirRival(r, p.dano, 10, 'golpe');
          p.vida = 0;
          break;
        }
      } else if (Math.hypot(j.cuerpo.x - p.x, j.cuerpo.z - p.z) < j.cuerpo.radio + p.radio && p.y < 2.2) {
        const r = this.golpearJugador(p.dano, p.color, p.x - p.vx * 0.1, p.z - p.vz * 0.1, p.origen);
        if (r === 'parry' && p.tipo === 'flecha') {
          // El bloqueo perfecto devuelve la flecha contra quien la lanzó.
          p.delJugador = true;
          p.vx = -p.vx * 1.2;
          p.vz = -p.vz * 1.2;
          p.dano *= 2;
          p.vida = 2;
          continue;
        }
        if (r === 'golpe' && p.tipo === 'red' && j.estado !== 'muerto') {
          j.estado = 'atrapado';
          j.t = 1.3;
          j.bloqueando = false;
          this.mensaje = '🕸️ ¡Atrapado en la red!';
          this.mensajeT = 1.2;
        }
        if (r !== 'esquivado') p.vida = 0;
      }
      if (Math.hypot(p.x, p.z) > this.arena.radio + 2) p.vida = 0;
      if (this.rejilla.cerca(p.x, p.z).some((b) => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2 && p.y < b.y1)) p.vida = 0;
    }
    this.proyectiles = this.proyectiles.filter((p) => p.vida > 0);
  }

  private actualizarAreas(dt: number) {
    const j = this.jugador;
    for (const a of this.areas) {
      a.t -= dt;
      if (a.t > 0) continue;
      if (Math.hypot(j.cuerpo.x - a.x, j.cuerpo.z - a.z) < a.r + j.cuerpo.radio) this.golpearJugador(a.dano, a.color, a.x, a.z, a.origen);
      this.efecto('polvo', a.x, 0.3, a.z, a.r, 0.4);
    }
    this.areas = this.areas.filter((a) => a.t > 0);
  }

  /** Los pinchos hieren a quien esté encima: se puede atraer a los rivales hacia ellos. */
  private actualizarTrampas(dt: number) {
    const j = this.jugador;
    for (const t of this.arena.trampas) {
      if (j.estado !== 'muerto' && j.estado !== 'esquivando' && Math.hypot(j.cuerpo.x - t.x, j.cuerpo.z - t.z) < t.r) {
        j.vida -= 12 * this.modo.dano * dt;
        if (j.vida <= 0) this.caer();
      }
      for (const r of this.vivos) {
        if (r.estado !== 'aparecer' && Math.hypot(r.cuerpo.x - t.x, r.cuerpo.z - t.z) < t.r) this.herirRival(r, 18 * dt, 0, 'trampa');
      }
    }
  }

  efecto(tipo: TipoEfecto, x: number, y: number, z: number, r: number, t: number) {
    if (this.efectos.length > 60) this.efectos.shift();
    this.efectos.push({ tipo, x, y, z, r, t, total: t });
  }

  /** Separa a los rivales para que no se amontonen en el mismo sitio. */
  private separarRivales() {
    const vivos = this.vivos;
    for (let i = 0; i < vivos.length; i++) {
      for (let k = i + 1; k < vivos.length; k++) {
        const a = vivos[i].cuerpo;
        const b = vivos[k].cuerpo;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.radio + b.radio + 0.1;
        if (d >= min || d < 1e-4) continue;
        const emp = (min - d) / 2;
        a.x -= (dx / d) * emp;
        a.z -= (dz / d) * emp;
        b.x += (dx / d) * emp;
        b.z += (dz / d) * emp;
      }
    }
  }
}
