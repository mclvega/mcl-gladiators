import { angulo, enArco, yawHacia } from '../core/combate';
import type { DefAtaque } from '../core/rivales';
import { moverCuerpo } from '../core/fisica';
import type { Partida, Rival } from './logica';

const CUERPO_A_CUERPO = new Set(['golpe', 'embestida', 'zarpazo']);

const atacandoCerca = (r: Rival) => (r.estado === 'aviso' || r.estado === 'embestida') && !!r.ataque && CUERPO_A_CUERPO.has(r.ataque.tipo);

function elegirAtaque(p: Partida, r: Rival, dist: number, turno: boolean, ve: boolean): DefAtaque | null {
  const posibles = r.d.ataques.filter((a) => {
    if ((r.recargas[a.nombre] ?? 0) > 0) return false;
    if (CUERPO_A_CUERPO.has(a.tipo) && !turno) return false;
    if (a.tipo === 'golpe') return dist <= a.alcance + 0.2;
    if (a.tipo === 'zarpazo') return dist <= (a.radio ?? 3) * 0.8;
    if (a.tipo === 'embestida') return dist > 3 && dist <= a.alcance && ve;
    return dist <= a.alcance && ve;
  });
  if (!posibles.length) return null;
  // Castigo: si el jugador está vendido (sin estamina, cargando o recuperándose), van a por los golpes más fuertes.
  const j = p.jugador;
  const vendido = j.estado === 'guardiaRota' || j.estado === 'cargando' || j.estado === 'atrapado' || j.estamina < 15;
  let t = p.rng.siguiente() * posibles.reduce((s, a) => s + a.peso * (vendido && a.dano > 12 ? 2 : 1), 0);
  for (const a of posibles) {
    t -= a.peso * (vendido && a.dano > 12 ? 2 : 1);
    if (t < 0) return a;
  }
  return posibles[0];
}

/** Empieza el aviso; el zarpazo se marca ya en el suelo alrededor del rival. */
function empezarAtaque(p: Partida, r: Rival, a: DefAtaque) {
  r.estado = 'aviso';
  r.ataque = a;
  r.t = 0;
  if (a.tipo === 'zarpazo') {
    const aviso = p.avisoDe(r, a);
    p.areas.push({ x: r.cuerpo.x, z: r.cuerpo.z, r: a.radio ?? 3, t: aviso, total: aviso, dano: a.dano * r.mult, color: a.color, origen: r });
  }
}

function lanzarAtaque(p: Partida, r: Rival, a: DefAtaque) {
  const j = p.jugador.cuerpo;
  r.recargas[a.nombre] = a.recarga;
  switch (a.tipo) {
    case 'golpe':
      if (enArco(r.cuerpo.x, r.cuerpo.z, r.yaw, j.x, j.z, j.radio, a.alcance + 0.3, a.arco)) p.golpearJugador(a.dano * r.mult, a.color, r.cuerpo.x, r.cuerpo.z, r);
      break;
    case 'proyectil':
    case 'red': {
      const n = a.cantidad ?? 1;
      const base = yawHacia(r.cuerpo.x, r.cuerpo.z, j.x, j.z);
      for (let i = 0; i < n; i++) {
        const yaw = base + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0);
        const v = a.velocidad ?? 12;
        p.proyectiles.push({
          x: r.cuerpo.x - Math.sin(yaw) * (r.d.radio + 0.3), y: 1.3, z: r.cuerpo.z - Math.cos(yaw) * (r.d.radio + 0.3),
          vx: -Math.sin(yaw) * v, vz: -Math.cos(yaw) * v, dano: a.dano * r.mult, radio: a.tipo === 'red' ? 0.6 : 0.3, color: a.color,
          delJugador: false, vida: a.tipo === 'red' ? 0.8 : 3, tipo: a.tipo === 'red' ? 'red' : 'flecha', origen: r,
        });
      }
      break;
    }
    case 'embestida':
      r.estado = 'embestida';
      r.t = a.alcance / 14;
      r.embX = -Math.sin(r.yaw);
      r.embZ = -Math.cos(r.yaw);
      r.golpeoEmbestida = false;
      return;
    case 'zarpazo':
      break;
  }
  r.estado = 'recuperar';
  r.t = a.recuperacion;
}

function moverRival(p: Partida, r: Rival, vx: number, vz: number, dt: number) {
  moverCuerpo(r.cuerpo, vx * dt, vz * dt, dt, p.rejilla);
  const d = Math.hypot(r.cuerpo.x, r.cuerpo.z);
  const max = p.arena.radio - 0.6;
  if (d > max) {
    r.cuerpo.x = (r.cuerpo.x / d) * max;
    r.cuerpo.z = (r.cuerpo.z / d) * max;
  }
}

/** Camina hacia un punto: en línea recta si se puede; si no, por el camino de A*. */
function irHacia(p: Partida, r: Rival, x: number, z: number, vel: number, dt: number) {
  const desde = { x: r.cuerpo.x, z: r.cuerpo.z };
  let objetivo = { x, z };
  if (!p.nav.recto(desde, objetivo)) {
    r.rutaT -= dt;
    if (r.rutaT <= 0 || !r.ruta.length) {
      r.ruta = p.nav.camino(desde, objetivo) ?? [];
      r.rutaT = 0.6;
    }
    while (r.ruta.length && Math.hypot(r.ruta[0].x - desde.x, r.ruta[0].z - desde.z) < 0.6) r.ruta.shift();
    if (r.ruta.length) objetivo = r.ruta[0];
  } else r.ruta = [];
  const dx = objetivo.x - desde.x;
  const dz = objetivo.z - desde.z;
  const d = Math.hypot(dx, dz) || 1;
  moverRival(p, r, (dx / d) * vel, (dz / d) * vel, dt);
}

/**
 * Los rivales listos ven venir los ataques: una vez por ataque del jugador, si está cerca y de frente,
 * pueden apartarse de un salto (más a medida que avanzan los combates, y los campeones aún más).
 */
function reaccionar(p: Partida, r: Rival, dist: number): boolean {
  const j = p.jugador;
  if (j.estado !== 'atacando' || j.golpeHecho || r.reaccion === j.ataqueId) return false;
  r.reaccion = j.ataqueId;
  if (dist > (j.golpe?.alcance ?? 2.5) + 1.2) return false;
  const prob = r.d.esquiva * (0.5 + p.ia) * (r.campeon ? 1.6 : 1);
  if (p.rng.siguiente() >= prob) return false;
  r.estado = 'esquivando';
  r.t = 0.35;
  // Atrás y a un lado.
  const huida = yawHacia(j.cuerpo.x, j.cuerpo.z, r.cuerpo.x, r.cuerpo.z) + r.rodeo * 0.7;
  r.embX = -Math.sin(huida);
  r.embZ = -Math.cos(huida);
  return true;
}

export function actualizarRival(p: Partida, r: Rival, dt: number) {
  if (r.estado === 'muerto') return;
  for (const k in r.recargas) r.recargas[k] -= dt;

  const j = p.jugador;
  const obj = { x: j.cuerpo.x, z: j.cuerpo.z };
  const dx = obj.x - r.cuerpo.x;
  const dz = obj.z - r.cuerpo.z;
  const dist = Math.hypot(dx, dz) - r.d.radio;

  switch (r.estado) {
    case 'aparecer':
      r.t -= dt;
      if (r.t <= 0) r.estado = 'mover';
      return;
    case 'aturdido':
      r.t -= dt;
      if (r.t <= 0) {
        r.estado = 'mover';
        r.aturd = 0;
      }
      return;
    case 'atrapado':
    case 'tambaleo':
    case 'recuperar':
      r.t -= dt;
      if (r.t <= 0) r.estado = 'mover';
      return;
    case 'esquivando':
      r.t -= dt;
      moverRival(p, r, r.embX * 8, r.embZ * 8, dt);
      if (r.t <= 0) {
        r.estado = 'mover';
        // Tras esquivar, contraataca antes.
        for (const a of r.d.ataques) if (a.tipo === 'golpe') r.recargas[a.nombre] = Math.min(r.recargas[a.nombre] ?? 0, 0.1);
      }
      return;
    case 'aviso': {
      const a = r.ataque!;
      r.t += dt;
      const aviso = p.avisoDe(r, a);
      // Sigue al objetivo durante casi todo el aviso; al final se queda fijo (así se puede esquivar).
      if (r.t < aviso * 0.75) r.yaw += angulo(yawHacia(r.cuerpo.x, r.cuerpo.z, obj.x, obj.z) - r.yaw) * Math.min(1, dt * 8);
      if (r.t >= aviso) lanzarAtaque(p, r, a);
      return;
    }
    case 'embestida': {
      const a = r.ataque!;
      r.t -= dt;
      moverRival(p, r, r.embX * 14, r.embZ * 14, dt);
      if (!r.golpeoEmbestida && Math.hypot(j.cuerpo.x - r.cuerpo.x, j.cuerpo.z - r.cuerpo.z) < r.d.radio + j.cuerpo.radio + 0.4) {
        r.golpeoEmbestida = true;
        p.golpearJugador(a.dano * r.mult, a.color, r.cuerpo.x, r.cuerpo.z, r);
      }
      if (r.t <= 0) {
        r.estado = 'recuperar';
        r.t = a.recuperacion;
      }
      return;
    }
  }

  // Mover: reaccionar, decidir ataque o acercarse/rodear.
  if (reaccionar(p, r, dist)) return;
  r.yaw += angulo(yawHacia(r.cuerpo.x, r.cuerpo.z, obj.x, obj.z) - r.yaw) * Math.min(1, dt * 6);
  const ve = p.nav.recto({ x: r.cuerpo.x, z: r.cuerpo.z }, obj);
  // Turno de ataque: solo unos pocos atacan cuerpo a cuerpo a la vez (los campeones siempre).
  const ocupados = p.vivos.filter((o) => o !== r && atacandoCerca(o)).length;
  const turno = r.campeon || ocupados < p.modo.atacantes;
  if (j.estado !== 'muerto') {
    const a = elegirAtaque(p, r, dist, turno, ve);
    if (a) return empezarAtaque(p, r, a);
  }

  const vel = r.velocidad;
  const lejos = r.d.distancia;
  if (dist > lejos + 0.3) {
    // Sin turno, los de cuerpo a cuerpo esperan en círculo a unos metros, buscando tu espalda.
    if (!turno && lejos < 4 && dist < 5.5) {
      const l = Math.hypot(dx, dz) || 1;
      const tx = -dz / l;
      const tz = dx / l;
      const acercar = dist > 4.2 ? 0.5 : dist < 3.2 ? -0.5 : 0;
      moverRival(p, r, (tx * r.rodeo + (dx / l) * acercar) * vel * 0.45, (tz * r.rodeo + (dz / l) * acercar) * vel * 0.45, dt);
      if (p.rng.siguiente() < dt * 0.3) r.rodeo *= -1;
      return;
    }
    irHacia(p, r, obj.x, obj.z, vel, dt);
  } else if (lejos > 4 && dist < lejos * 0.55) {
    // Los de distancia se alejan si te acercas.
    moverRival(p, r, (-dx / (dist + 0.01)) * vel * 0.8, (-dz / (dist + 0.01)) * vel * 0.8, dt);
  } else if (lejos < 4 && p.rng.siguiente() < dt * 0.8) {
    // Cuerpo a cuerpo a la espera de la recarga: un paso lateral para no quedarse quieto.
    r.rodeo *= p.rng.siguiente() < 0.5 ? -1 : 1;
  }
}
