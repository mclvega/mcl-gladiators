import './styles.css';

import { app } from './app';
import { audio } from './audio';
import { temaDe } from './core/arena';
import { generarCombate, REGLAS } from './core/combates';
import { Controles, type Accion, type Fuente } from './core/controles';
import { MODOS } from './core/difficulty';
import { NOMBRE_RANURA, RANURAS } from './core/equipo';
import { Mando, Teclado } from './core/input';
import { iniciarBucle } from './core/loop';
import { calcularStats, rangoDe } from './core/progreso';
import { iniciarPantallaCompleta } from './fullscreen';
import { controlesVacios, Partida } from './game/logica';
import type { Render3D } from './game/render3d';
import { Rendimiento, tamanoSombras } from './rendimiento';
import { anotarCombate, limpiarNombre } from './storage';
import { panelConfiguracion } from './ui/configuracion';
import { boton, h, mostrarPanel } from './ui/dom';
import { pantallaLudus } from './ui/ludus';
import { navegarMenu } from './ui/navmando';
import { ControlesPsp } from './ui/psp';
import { ControlesCompletos } from './ui/tactil';

const hud = document.getElementById('lienzo') as HTMLCanvasElement;
const ctx = hud.getContext('2d')!;
const lienzo3d = document.createElement('canvas');
lienzo3d.id = 'lienzo3d';
hud.before(lienzo3d);
const contenedor = document.getElementById('controles')!;

/* ---------- Controles: teclado y ratón, mando físico y dos modos táctiles ---------- */

const tactil = matchMedia('(pointer: coarse)').matches || (import.meta.env.DEV && location.search.includes('tactil'));
if (tactil) document.body.classList.add('tactil');
const teclado = new Teclado();
const controles = new Controles();
let avisoMando = '';
let avisoMandoT = 0;
const mando = new Mando((nombre, conectado) => {
  avisoMando = conectado ? `🎮 Mando conectado${nombre ? `: ${nombre.split('(')[0].trim().slice(0, 32)}` : ''}` : '🎮 Mando desconectado';
  avisoMandoT = 3;
  document.body.classList.toggle('mando', conectado && mando.usado);
});
const psp = new ControlesPsp(contenedor, {
  cuadrado: 'Ligero', triangulo: 'Fuerte', cruz: 'Esquivar', circulo: 'Gloria', L: 'Fijar', R: 'Escudo', select: 'Fijar', start: 'Pausa',
});
const completos = new ControlesCompletos(contenedor);

/** El mando PSP en pantalla como una fuente más. */
function fuentePsp(): Fuente {
  const activas: Accion[] = [];
  if (psp.activo('cuadrado')) activas.push('ligero');
  if (psp.activo('triangulo')) activas.push('fuerte');
  if (psp.activo('cruz')) activas.push('esquiva');
  if (psp.activo('circulo')) activas.push('gloria');
  if (psp.activo('R')) activas.push('bloqueo');
  if (psp.activo('L') || psp.activo('select')) activas.push('fijar');
  if (psp.activo('start')) activas.push('pausa');
  return { x: psp.x, y: psp.y, camX: 0, camY: 0, activas };
}

let partida: Partida | null = null;
let render: Render3D | null = null;
let modulo3d: Promise<typeof import('./game/render3d')> | null = null;
const cargar3d = () => (modulo3d ??= import('./game/render3d'));

iniciarPantallaCompleta(() => app.g.config.pantallaCompleta, 'landscape');
app.aplicarConfig();

/* ---------- Tamaño ---------- */

const rend = new Rendimiento(() => app.g.config.calidad, () => app.g.config.limiteFps, () => ajustar());
let ancho = innerWidth;
let alto = innerHeight;
function ajustar() {
  ancho = innerWidth;
  alto = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (const c of [hud, lienzo3d]) {
    c.style.width = `${ancho}px`;
    c.style.height = `${alto}px`;
  }
  hud.width = Math.round(ancho * dpr);
  hud.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render?.ajustar(ancho, alto, rend.ratio);
}
addEventListener('resize', ajustar);
ajustar();

/* ---------- Cámara y ataques con el ratón ---------- */

let giroX = 0;
let giroY = 0;
let ligeroRaton = false;
let fuerteRaton = false;
const sensibilidad = () => app.g.config.sensibilidad / 5;

addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== lienzo3d) return;
  giroX += e.movementX * 0.0025 * sensibilidad();
  giroY += e.movementY * 0.0025 * sensibilidad();
});
lienzo3d.addEventListener('mousedown', (e) => {
  if (!partida || tactil) return;
  if (document.pointerLockElement !== lienzo3d) {
    void lienzo3d.requestPointerLock();
    return;
  }
  if (e.button === 0) ligeroRaton = true;
  if (e.button === 2) fuerteRaton = true;
});
addEventListener('mouseup', (e) => e.button === 2 && (fuerteRaton = false));
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== lienzo3d && partida?.fase === 'combate' && !partida.pausada && !tactil && !mando.usado && document.body.classList.contains('jugando')) pausar();
});

// Táctil: arrastrar en la mitad derecha mueve la cámara.
const GIRO_TACTIL = 0.006;
const zonaMirar = h('div', { class: 'zona-mirar' });
contenedor.prepend(zonaMirar);
let toque = { id: -1, x: 0, y: 0 };
zonaMirar.addEventListener('pointerdown', (e) => {
  if (toque.id !== -1) return;
  zonaMirar.setPointerCapture(e.pointerId);
  toque = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
zonaMirar.addEventListener('pointermove', (e) => {
  if (e.pointerId !== toque.id) return;
  giroX += (e.clientX - toque.x) * GIRO_TACTIL * sensibilidad();
  giroY += (e.clientY - toque.y) * GIRO_TACTIL * sensibilidad();
  toque.x = e.clientX;
  toque.y = e.clientY;
});
const soltarToque = (e: PointerEvent) => e.pointerId === toque.id && (toque.id = -1);
zonaMirar.addEventListener('pointerup', soltarToque);
zonaMirar.addEventListener('pointercancel', soltarToque);
// Al tocar la pantalla vuelven los controles táctiles aunque haya un mando.
addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || !mando.usado) return;
  mando.usado = false;
  document.body.classList.remove('mando');
});

document.body.append(h('button', { type: 'button', class: 'boton-pausa', 'aria-label': 'Pausa', text: '⏸', onclick: () => pausar() }));

const vibrar = (ms: number) => {
  if (!app.g.config.vibracion) return;
  navigator.vibrate?.(ms);
  mando.vibrar(ms * 3, ms > 30 ? 0.8 : 0.5);
};

/* ---------- Pantallas ---------- */

function jugando(si: boolean) {
  document.body.classList.toggle('jugando', si);
  if (!si) {
    controles.limpiar();
    teclado.limpiar();
    psp.limpiar();
    completos.limpiar();
    fuerteRaton = ligeroRaton = false;
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (!tactil && !mando.usado) void lienzo3d.requestPointerLock?.();
}

function ayuda(): string {
  if (mando.usado) return 'Mando: stick izquierdo para moverte y derecho para la cámara. X/□ ligero, Y/△ fuerte (mantén para cargar), A/✕ esquivar, RB/R1 escudo (justo a tiempo: bloqueo perfecto), LB/L1 fijar, B/○ golpe de gloria, Start pausa.';
  if (tactil && app.g.config.controles === 'psp') return 'Modo PSP: stick o cruceta para moverte; arrastra en la pantalla para la cámara. □ ligero, △ fuerte (mantén para cargar), ✕ esquivar, R escudo, L fijar, ○ golpe de gloria, START pausa.';
  if (tactil) return 'Joystick a la izquierda; arrastra a la derecha para la cámara. ⚔️ ligero, 💥 fuerte (mantén para cargar), 💨 esquivar, 🛡️ escudo (justo a tiempo: bloqueo perfecto), 🎯 fijar, 🔥 golpe de gloria.';
  return 'WASD y ratón. Clic izquierdo (o J): ligero. Clic derecho (o K) mantenido: fuerte cargado. Espacio: esquivar. Mayús: escudo (justo a tiempo: bloqueo perfecto). Q: fijar. E: golpe de gloria. P: pausa.';
}
const AVISOS = 'Aviso amarillo: bloquea. Rojo: esquiva. Azul: bloqueo perfecto. Todo gasta estamina: si te quedas sin ella mientras bloqueas, se rompe tu guardia.';

function bienvenida() {
  jugando(false);
  const campo = h('input', { type: 'text', maxlength: '20', placeholder: 'Tu nombre', 'aria-label': 'Tu nombre' }) as HTMLInputElement;
  const error = h('p', { class: 'error-campo', 'aria-live': 'polite' });
  const seguir = () => {
    const nombre = limpiarNombre(campo.value);
    if (!nombre) {
      error.textContent = 'Escribe tu nombre (hasta 20 caracteres).';
      return;
    }
    app.g.nombre = nombre;
    app.guardar();
    menu();
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && seguir());
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '⚔️ McL Gladiators' }),
      h('p', { class: 'texto-suave', text: 'Entras al ludus como novato. Combate tras combate, sin final: gana oro y fama, entrena, mejora tu equipo y conquista al público.' }),
      campo,
      error,
      boton('Empezar', seguir, { variante: 'primario' }),
    ),
  );
  campo.focus();
}

function menu() {
  jugando(false);
  partida = null;
  const g = app.g;
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h1', { text: '⚔️ McL Gladiators' }),
      h('p', { class: 'texto-suave', text: `¡Ave, ${app.nombre()}! · ${rangoDe(g.fama).nombre} · Combate ${g.combate} · 💰 ${g.oro}` }),
      boton('Jugar (ir al ludus)', ludus, { variante: 'primario', icono: '▶' }),
      boton(`Dificultad: ${MODOS[g.config.dificultad].nombre}`, () => configuracion(), { icono: '🎯' }),
      boton('Personaje', () => void import('./ui/personaje').then((m) => m.pantallaPersonaje(menu)), { icono: '👕' }),
      boton('Récords', records, { icono: '🏆' }),
      boton('Configuración', () => configuracion(), { icono: '⚙️' }),
      h('p', { class: 'texto-suave ayuda-texto', text: `${ayuda()} ${AVISOS}` }),
    ),
  );
}

function ludus() {
  jugando(false);
  partida = null;
  pantallaLudus({ alLuchar: empezar, alVolver: menu });
}

function configuracion(volver: () => void = menu, enJuego = false) {
  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Volver', () => volver(), { icono: '←' }), h('h2', { text: '⚙️ Configuración' })),
      panelConfiguracion({ enJuego, alReiniciar: () => (app.g.nombre ? configuracion(volver, enJuego) : bienvenida()) }),
    ),
  );
}

function records() {
  const e = app.g.estadisticas;
  const dato = (t: string, v: string | number) => h('div', { class: 'fila-mejora' }, h('span', { text: t }), h('strong', { text: String(v) }));
  const filas = app.g.records.length
    ? app.g.records.map((r, i) => h('div', { class: 'fila-mejora' }, h('span', { text: `${i + 1}. ${r.nombre}` }), h('span', { text: `Combate ${r.combate} · ⭐ ${r.fama} · ${rangoDe(r.fama).nombre}` })))
    : [h('p', { class: 'texto-suave', text: 'Aún no hay récords. ¡Gana tu primer combate!' })];
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('div', { class: 'cabecera' }, boton('Volver', menu, { icono: '←' }), h('h2', { text: '🏆 Récords' })),
      dato('Combate más alto ganado', app.g.combate - 1),
      dato('Rango', `${rangoDe(app.g.fama).nombre} (⭐ ${app.g.fama})`),
      dato('Victorias / derrotas', `${e.victorias} / ${e.derrotas}`),
      dato('Campeones vencidos', e.campeones),
      dato('Rivales derrotados', e.bajas),
      dato('Bloqueos perfectos', e.perfectos),
      dato('Oro ganado en total', e.oroTotal),
      h('h2', { text: 'Mejores gladiadores' }),
      ...filas,
    ),
  );
}

/* ---------- Combate ---------- */

let marcaDano = 0;
let marcaParry = 0;
let finMostrado = false;

async function empezar() {
  audio.iniciar();
  const mod = await cargar3d();
  const g = app.g;
  finMostrado = false;
  const p = new Partida({
    modo: MODOS[g.config.dificultad],
    combate: generarCombate(g.combate),
    stats: calcularStats(g.atributos, g.equipo, g.arma),
    equipo: g.equipo,
    arma: g.arma,
    eventos: {
      acierto: (c) => audio.efecto(c ? 'explosion' : 'golpe'),
      dano: (fuerte) => {
        marcaDano = 0.6;
        audio.efecto('dano');
        vibrar(fuerte ? 60 : 35);
      },
      parry: () => {
        marcaParry = 0.35;
        audio.efecto('nivel');
        vibrar(25);
      },
      bloqueo: () => audio.efecto('boton'),
      guardiaRota: () => {
        audio.efecto('muerte');
        vibrar(80);
      },
      baja: () => audio.efecto('muerte'),
      remate: () => audio.efecto('explosion'),
      gloria: () => {
        audio.efecto('explosion');
        vibrar(70);
      },
      red: () => audio.efecto('disparo'),
      rotura: () => audio.efecto('dano'),
      oleada: () => audio.efecto('nivel'),
      fin: (r) => {
        anotarCombate(app.g, r, app.nombre());
        app.guardar();
      },
    },
  });
  partida = p;
  if (import.meta.env.DEV) (window as unknown as { __partida: Partida }).__partida = p;
  if (!render) render = new mod.Render3D(lienzo3d);
  ajustar();
  mostrarPanel(null);
  jugando(true);
}

function pausar() {
  const p = partida;
  if (!p || p.fase !== 'combate' || p.pausada) return;
  p.pausada = true;
  jugando(false);
  const c = p.combate;
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: '⏸ Pausa' }),
      h('p', { class: 'texto-suave', text: `Combate ${c.n} · ${REGLAS[c.regla].nombre} · ${p.tema.nombre} · ${p.bajas} rivales caídos` }),
      boton('Continuar', continuar, { variante: 'primario', icono: '▶' }),
      boton('Configuración', () => configuracion(pausar2, true), { icono: '⚙️' }),
      boton('Salir (rendirse)', () => {
        if (!confirm('Si sales, el combate cuenta como derrota (no pierdes nada más). ¿Seguro?')) return;
        p.pausada = false;
        p.abandonar();
      }, { icono: '🚪' }),
      h('p', { class: 'texto-suave ayuda-texto', text: ayuda() }),
    ),
  );
}

function pausar2() {
  if (!partida) return menu();
  partida.pausada = false;
  pausar();
}

function continuar() {
  if (!partida) return;
  partida.pausada = false;
  mostrarPanel(null);
  jugando(true);
}

/** Fin del combate: resumen, premio y qué hacer después. */
function pantallaFin(p: Partida) {
  jugando(false);
  const r = p.resumen!;
  const g = app.g;
  const tiempo = `${Math.floor(r.tiempo / 60)}:${String(r.tiempo % 60).padStart(2, '0')}`;
  const publico = r.fervorMedio >= 60 ? '🔥 El público te adora' : r.fervorMedio >= 30 ? '👏 El público aplaude' : '😐 El público bosteza';
  mostrarPanel(
    h('div', { class: 'tarjeta' },
      h('h2', { text: r.victoria ? (r.campeon ? `👑 ¡Has vencido a ${p.combate.campeon}!` : '🏆 ¡Victoria!') : '💀 Derrota' }),
      h('p', { class: 'texto-suave', text: `Combate ${p.combate.n} · ${REGLAS[p.combate.regla].nombre} · ${r.bajas} ${r.bajas === 1 ? 'rival' : 'rivales'} · ${r.perfectos} ${r.perfectos === 1 ? 'bloqueo perfecto' : 'bloqueos perfectos'} · ${tiempo}` }),
      r.victoria
        ? h('p', { class: 'premio', text: `+💰 ${r.oro} · +⭐ ${r.fama} · ${publico}` })
        : h('p', { class: 'texto-suave', text: 'No pierdes nada: el equipo sigue gastado, eso sí. Entrena, repara y vuelve a intentarlo.' }),
      r.rotas.length ? h('p', { class: 'aviso', text: `💔 Se rompió: ${r.rotas.join(', ')}.` }) : null,
      boton(r.victoria ? 'Al ludus' : 'Reintentar', r.victoria ? ludus : empezar, { variante: 'primario', icono: r.victoria ? '🏛️' : '↻' }),
      r.victoria ? boton(`Siguiente combate (${g.combate})`, empezar, { icono: '⚔️' }) : boton('Al ludus', ludus, { icono: '🏛️' }),
      boton('Menú', menu, { icono: '🏠' }),
    ),
  );
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || (e.code === 'Escape' && tactil)) pausar();
});
document.addEventListener('visibilitychange', () => document.hidden && pausar());

/* ---------- HUD ---------- */

const COLOR_AVISO = { amarillo: '#ffd23f', rojo: '#ff3030', azul: '#3cb4ff' };

const sombra = (texto: string, x: number, y: number, color = '#fff') => {
  ctx.fillStyle = '#000a';
  ctx.fillText(texto, x + 1.5, y + 1.5);
  ctx.fillStyle = color;
  ctx.fillText(texto, x, y);
};

function barra(x: number, y: number, w: number, hh: number, valor: number, color: string, fondo = '#000a') {
  ctx.fillStyle = fondo;
  ctx.fillRect(x, y, w, hh);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, Math.max(0, valor))), hh - 2);
}

/** Nombre del botón de cada acción según cómo se está jugando. */
function tecla(a: 'gloria' | 'ligero'): string {
  if (mando.usado) return a === 'gloria' ? 'B/○' : 'X/□';
  if (tactil) return app.g.config.controles === 'psp' ? (a === 'gloria' ? '○' : '□') : a === 'gloria' ? '🔥' : '⚔️';
  return a === 'gloria' ? 'E' : 'clic';
}

function dibujarHud(p: Partida, dt: number) {
  ctx.clearRect(0, 0, ancho, alto);
  ctx.textBaseline = 'middle';
  marcaDano = Math.max(0, marcaDano - dt);
  marcaParry = Math.max(0, marcaParry - dt);
  const j = p.jugador;
  const s = p.stats;
  const cx = ancho / 2;

  if (marcaDano > 0 || j.vida < s.vidaMax * 0.25) {
    const g = ctx.createRadialGradient(cx, alto / 2, Math.min(ancho, alto) * 0.3, cx, alto / 2, Math.max(ancho, alto) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${Math.max(marcaDano * 0.6, j.vida < s.vidaMax * 0.25 ? 0.3 : 0)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ancho, alto);
  }
  if (marcaParry > 0) {
    ctx.fillStyle = `rgba(120,210,255,${marcaParry * 0.5})`;
    ctx.fillRect(0, 0, ancho, alto);
  }
  if (p.lento) {
    ctx.fillStyle = 'rgba(255,40,40,0.08)';
    ctx.fillRect(0, 0, ancho, alto);
  }

  // Barras y avisos sobre los rivales.
  if (render) {
    for (const r of p.rivales) {
      if (r.estado === 'muerto' || r.estado === 'aparecer') continue;
      const pt = render.proyectar(r.cuerpo.x, 2.1 * r.d.escala, r.cuerpo.z, ancho, alto);
      if (!pt.visible) {
        // Fuera de la pantalla: flecha en el borde si te va a atacar.
        if (r.estado === 'aviso' && r.ataque) {
          const ex = pt.detras ? ancho - pt.x : pt.x;
          const ey = pt.detras ? alto - pt.y : pt.y;
          const ang = Math.atan2(ey - alto / 2, ex - cx);
          const rr = Math.min(ancho, alto) * 0.42;
          const ax = cx + Math.cos(ang) * rr;
          const ay = alto / 2 + Math.sin(ang) * rr;
          ctx.fillStyle = COLOR_AVISO[r.ataque.color];
          ctx.beginPath();
          ctx.moveTo(ax + Math.cos(ang) * 16, ay + Math.sin(ang) * 16);
          ctx.lineTo(ax + Math.cos(ang + 2.4) * 12, ay + Math.sin(ang + 2.4) * 12);
          ctx.lineTo(ax + Math.cos(ang - 2.4) * 12, ay + Math.sin(ang - 2.4) * 12);
          ctx.fill();
        }
        continue;
      }
      if (r.campeon) continue;
      const w = 52;
      barra(pt.x - w / 2, pt.y, w, 6, r.vida / r.vidaMax, '#e53935');
      // Guardia y aturdimiento: al llenarse, el rival queda a merced.
      barra(pt.x - w / 2, pt.y + 7, w, 4, r.estado === 'aturdido' ? 1 : r.aturd / r.aturdMax, r.estado === 'aturdido' ? '#fff' : r.d.escudo ? '#5ab0ff' : '#ffd23f');
      ctx.textAlign = 'center';
      if (r.estado === 'aviso' && r.ataque) {
        ctx.font = 'bold 18px system-ui, sans-serif';
        sombra('!', pt.x, pt.y - 14, COLOR_AVISO[r.ataque.color]);
      } else if (r.estado === 'aturdido') {
        ctx.font = 'bold 12px system-ui, sans-serif';
        sombra(`${tecla('ligero')}: rematar`, pt.x, pt.y - 12, '#fff');
      } else if (r.estado === 'atrapado') {
        ctx.font = 'bold 12px system-ui, sans-serif';
        sombra('🕸️', pt.x, pt.y - 12, '#fff');
      }
    }
    ctx.textAlign = 'center';
    for (const n of p.numeros) {
      const pt = render.proyectar(n.x, n.y + (0.8 - n.t) * 0.8, n.z, ancho, alto);
      if (!pt.visible) continue;
      ctx.font = `bold ${n.critico ? 22 : 16}px system-ui, sans-serif`;
      sombra(String(n.valor), pt.x, pt.y, n.propio ? '#ff6a6a' : n.critico ? '#ffd23f' : '#fff');
    }
  }

  // Vida, estamina y fervor (arriba a la izquierda; en modo PSP, a la derecha del botón L).
  const psp = tactil && !mando.usado && app.g.config.controles === 'psp';
  const bx = psp ? 112 : 14;
  const by = 14;
  const bw = tactil ? Math.min(200, ancho * 0.24) : Math.min(260, ancho * 0.36);
  barra(bx, by, bw, 18, j.vida / s.vidaMax, j.vida > s.vidaMax * 0.3 ? '#5ad13c' : '#ff5a5a');
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  sombra(`❤️ ${Math.ceil(Math.max(0, j.vida))}/${s.vidaMax}`, bx + 6, by + 9);
  const parpadeo = p.sinAliento > 0 && p.tiempo % 0.2 < 0.1;
  barra(bx, by + 21, bw * 0.85, 10, j.estamina / s.estaminaMax, parpadeo ? '#ff5a5a' : j.estado === 'guardiaRota' ? '#888' : '#4fc3f7');
  ctx.font = 'bold 10px system-ui, sans-serif';
  sombra(j.estado === 'guardiaRota' ? '💢 Guardia rota' : '💨 Estamina', bx + 6, by + 26);
  const lista = j.fervor >= 100;
  barra(bx, by + 34, bw * 0.85, 10, j.fervor / 100, lista ? (p.tiempo % 0.5 < 0.25 ? '#ffb020' : '#ff7a2a') : '#b5562a');
  sombra(lista ? `🔥 ¡Gloria lista! [${tecla('gloria')}]` : '🔥 Fervor del público', bx + 6, by + 39);
  completos.resaltar('gloria', lista);
  if (j.contraT > 0) {
    ctx.font = 'bold 12px system-ui, sans-serif';
    sombra('⚡ ¡Contraataque!', bx, by + 58, '#6fd8ff');
  }

  // Equipo: una casilla por pieza con su durabilidad.
  const ey = by + 74;
  RANURAS.forEach((r, i) => {
    const pz = p.equipo[r];
    const k = pz ? pz.durabilidad / pz.durMax : 0;
    const x = bx + i * 30;
    ctx.fillStyle = '#000a';
    ctx.fillRect(x, ey, 26, 26);
    ctx.fillStyle = !pz ? '#333' : k <= 0 ? '#c62828' : k < 0.35 ? '#ef8f00' : '#2e7d32';
    ctx.fillRect(x + 1, ey + 25 - 24 * Math.max(0.08, pz ? k : 1), 24, 24 * Math.max(0.08, pz ? k : 1));
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = pz ? 1 : 0.35;
    sombra(NOMBRE_RANURA[r].icono, x + 13, ey + 13);
    ctx.globalAlpha = 1;
  });

  // Combate y reglas (arriba en el centro).
  const c = p.combate;
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  sombra(`Combate ${c.n} · ${REGLAS[c.regla].icono} ${REGLAS[c.regla].nombre}${c.oleadas.length > 1 ? ` · oleada ${Math.min(p.oleada, c.oleadas.length)}/${c.oleadas.length}` : ''}`, cx, 20);
  ctx.font = '12px system-ui, sans-serif';
  sombra(temaDe(c.n).nombre, cx, 38, '#ddd');
  // Barra del campeón.
  const campeon = p.rivales.find((r) => r.campeon && r.estado !== 'muerto');
  if (campeon) {
    const w = Math.min(460, ancho * 0.6);
    ctx.font = 'bold 14px system-ui, sans-serif';
    sombra(`👑 ${c.campeon} (${campeon.d.nombre})`, cx, 56, '#ffd23f');
    barra(cx - w / 2, 66, w, 12, campeon.vida / campeon.vidaMax, '#c62828');
    barra(cx - w / 2, 79, w, 5, campeon.estado === 'aturdido' ? 1 : campeon.aturd / campeon.aturdMax, '#ffd23f');
  }
  // Rivales que quedan (arriba a la derecha, junto a la pausa).
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const quedan = p.vivos.length + c.oleadas.slice(p.oleada).reduce((s2, o) => s2 + o.length, 0);
  sombra(`⚔️ ${quedan}   ☠ ${p.bajas}   ✨ ${p.perfectos}`, psp ? ancho - 112 : ancho - 66, 26);

  // Mensajes del centro.
  ctx.textAlign = 'center';
  if (p.mensajeT > 0) {
    ctx.font = 'bold 24px system-ui, sans-serif';
    sombra(p.mensaje, cx, alto * 0.3, '#ffd23f');
  }
  if (avisoMandoT > 0) {
    avisoMandoT -= dt;
    ctx.font = 'bold 14px system-ui, sans-serif';
    sombra(avisoMando, cx, alto * 0.38, '#9fe8ff');
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

/* ---------- Bucle ---------- */

let fps = 60;
let ultimo = performance.now();
iniciarBucle(
  (dt) => rend.medir('logica', () => {
    psp.actualizar();
    const extra: Accion[] = [];
    if (ligeroRaton) extra.push('ligero');
    if (fuerteRaton) extra.push('fuerte');
    ligeroRaton = false;
    const fuentes = [teclado.fuente(extra), mando.fuente()];
    if (tactil) fuentes.push(app.g.config.controles === 'psp' ? fuentePsp() : completos.fuente());
    controles.actualizar(fuentes);
    document.body.classList.toggle('mando', mando.usado);

    const p = partida;
    const enMenu = !p || p.pausada || p.fase === 'fin' || !document.body.classList.contains('jugando');
    // Se lee siempre (para que el Start que pausa no cuente también como «reanudar»), pero solo se usa en los menús.
    const eventos = mando.navegar(dt);
    if (enMenu) {
      // Start en la pausa: seguir jugando.
      if (p && p.pausada && eventos.includes('start')) return continuar();
      navegarMenu(eventos);
    }
    if (!p) return;
    if (p.fase === 'fin') {
      if (!finMostrado) {
        finMostrado = true;
        pantallaFin(p);
      }
      return;
    }
    if (p.pausada) {
      giroX = giroY = 0;
      return;
    }
    if (controles.pulsado('pausa')) return pausar();
    const c = controlesVacios();
    c.x = controles.x;
    c.z = controles.y;
    // Stick derecho del mando: la cámara gira a velocidad constante.
    c.giroX = giroX + controles.camX * 2.6 * dt * sensibilidad();
    c.giroY = giroY + controles.camY * 1.6 * dt * sensibilidad();
    giroX = giroY = 0;
    c.ligero = controles.pulsado('ligero');
    c.fuerte = controles.activo('fuerte');
    c.esquivar = controles.pulsado('esquiva');
    c.bloquear = controles.activo('bloqueo');
    c.fijar = controles.pulsado('fijar');
    c.gloria = controles.pulsado('gloria');
    p.autoFijar = app.g.config.objetivoAuto;
    p.ayudaEsquiva = app.g.config.ayudaEsquiva;
    p.actualizar(dt, c);
  }),
  () => {
    const ahora = performance.now();
    if (!rend.debeDibujar(ahora, !partida || partida.pausada || partida.fase === 'fin')) return;
    const dt = Math.min(0.1, (ahora - ultimo) / 1000);
    fps = fps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;
    ultimo = ahora;
    if (partida && render) {
      render.sombras(tamanoSombras(app.g.config.calidad));
      rend.medir('render', () => render!.dibujar(partida!, app.g.look, !app.g.config.animacionesReducidas, dt));
      dibujarHud(partida, dt);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ancho, alto);
    }
    if (app.g.config.mostrarFps) {
      ctx.fillStyle = '#9f9';
      ctx.font = '11px monospace';
      ctx.fillText(`${Math.round(fps)} FPS`, 8, alto - 8);
    }
    rend.actualizarMonitor(render?.renderer ?? null);
  },
);

if (import.meta.env.DEV && location.search.includes('demo')) void empezar();
else if (app.g.nombre) menu();
else bienvenida();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
addEventListener('load', () => setTimeout(() => void cargar3d(), 800));
