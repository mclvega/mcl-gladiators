import { describe, expect, it } from 'vitest';
import { generarArena } from '../src/core/arena';
import { ARMAS } from '../src/core/armas';
import { costeBloqueo, defensa, enArco, regenerarEstamina, yawHacia } from '../src/core/combate';
import { generarCombate, premioCombate } from '../src/core/combates';
import { accionesMando, Controles, zonaMuerta } from '../src/core/controles';
import { escalaCombate, MODOS } from '../src/core/difficulty';
import { crearPieza, danoConArmadura, equipoInicial, generarTienda, precioReparar, zonaGolpeada, ZONAS } from '../src/core/equipo';
import { PASO } from '../src/core/loop';
import { atributosIniciales, calcularStats, costeAtributo, rangoDe } from '../src/core/progreso';
import { crearRng } from '../src/core/rng';
import { RIVALES } from '../src/core/rivales';
import { controlesVacios, Partida, type Controles as ControlesPartida } from '../src/game/logica';
import { normalizarConfig } from '../src/settings';
import { anotarCombate, guardadoNuevo, normalizarGuardado } from '../src/storage';

describe('combate', () => {
  it('arco de golpe y orientación', () => {
    expect(yawHacia(0, 0, 0, -5)).toBeCloseTo(0);
    expect(enArco(0, 0, 0, 0, -2, 0.4, 2.5, 1.6)).toBe(true);
    expect(enArco(0, 0, 0, 0, 2, 0.4, 2.5, 1.6)).toBe(false);
    expect(enArco(0, 0, 0, 0, 2, 0.4, 2.5, Math.PI * 2)).toBe(true);
    expect(enArco(0, 0, 0, 0, -4, 0.4, 2.5, 1.6)).toBe(false);
  });

  it('bloqueo, bloqueo perfecto y ataques rojos', () => {
    expect(defensa('amarillo', true, 0.1, 0.18, true)).toBe('parry');
    expect(defensa('amarillo', true, 0.5, 0.18, true)).toBe('bloqueo');
    expect(defensa('rojo', true, 0.05, 0.18, true)).toBe('golpe');
    expect(defensa('azul', true, 0.05, 0.18, false)).toBe('golpe');
    expect(defensa('amarillo', false, 0, 0.18, true)).toBe('golpe');
    expect(MODOS.muyFacil.parry).toBeGreaterThan(MODOS.desafio.parry);
  });

  it('estamina: pausa tras gastar, más lenta con el escudo y bloquear cansa menos con buen escudo', () => {
    expect(regenerarEstamina(50, 100, 30, 0.2, false, 1)).toBe(50);
    expect(regenerarEstamina(50, 100, 30, 1, false, 1)).toBe(80);
    expect(regenerarEstamina(50, 100, 30, 1, true, 1)).toBeLessThan(80);
    expect(regenerarEstamina(95, 100, 30, 1, false, 1)).toBe(100);
    expect(costeBloqueo(20, 0.9)).toBeLessThan(costeBloqueo(20, 0.5));
  });
});

describe('equipo y progreso', () => {
  it('la armadura para daño y se desgasta; rota no protege', () => {
    const p = crearPieza('torso', 3);
    const r = danoConArmadura(20, p);
    expect(r.dano).toBeLessThan(20);
    expect(r.desgaste).toBeGreaterThan(0);
    expect(danoConArmadura(20, null).dano).toBe(20);
    expect(danoConArmadura(20, { ...p, durabilidad: 0 }).dano).toBe(20);
    expect(crearPieza('torso', 8).defensa).toBeGreaterThan(crearPieza('torso', 1).defensa);
  });

  it('zonas del cuerpo y reparación', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 100; i++) vistas.add(zonaGolpeada(i / 100));
    expect(vistas.size).toBe(ZONAS.length);
    const p = crearPieza('cabeza', 2);
    expect(precioReparar(p)).toBe(0);
    p.durabilidad = 0;
    expect(precioReparar(p)).toBeGreaterThan(0);
  });

  it('la tienda es la misma para un combate y mejora con el tiempo', () => {
    expect(generarTienda(4)).toEqual(generarTienda(4));
    const nivel = (n: number) => Math.max(...generarTienda(n).map((o) => (o.tipo === 'pieza' ? o.pieza.nivel : o.arma.nivel)));
    expect(nivel(30)).toBeGreaterThan(nivel(1));
  });

  it('atributos, peso y rangos sin final', () => {
    const a = atributosIniciales();
    const base = calcularStats(a, equipoInicial(), { id: 'gladius', nivel: 1 });
    const fuerte = calcularStats({ ...a, fuerza: 5, aguante: 5 }, equipoInicial(), { id: 'gladius', nivel: 1 });
    expect(fuerte.dano).toBeGreaterThan(base.dano);
    expect(fuerte.estaminaMax).toBeGreaterThan(base.estaminaMax);
    const cargado = { ...equipoInicial() };
    for (const z of ZONAS) cargado[z] = crearPieza(z, 12, 0);
    expect(calcularStats(a, cargado, { id: 'maza', nivel: 1 }).velocidad).toBeLessThan(base.velocidad);
    expect(costeAtributo(5)).toBeGreaterThan(costeAtributo(0));
    expect(rangoDe(0).nombre).toBe('Novato');
    expect(rangoDe(5000).nombre).toMatch(/^Leyenda/);
    expect(rangoDe(50000).siguiente).toBeGreaterThan(50000);
  });
});

describe('combates sin fin', () => {
  it('reglas: duelos al principio y campeón cada 5', () => {
    expect(generarCombate(1).regla).toBe('duelo');
    expect(generarCombate(5).regla).toBe('campeon');
    expect(generarCombate(10).campeon).toBeTruthy();
    expect(generarCombate(7)).toEqual(generarCombate(7));
    for (let n = 1; n < 80; n++) {
      const c = generarCombate(n);
      expect(c.oleadas.flat().length).toBeGreaterThan(0);
      for (const r of c.oleadas.flat()) expect(RIVALES[r.tipo].desde).toBeLessThanOrEqual(n);
    }
  });

  it('la dificultad y el premio crecen', () => {
    expect(escalaCombate(30).vida).toBeGreaterThan(escalaCombate(1).vida);
    expect(escalaCombate(500).ia).toBe(1);
    expect(premioCombate(20, 'duelo', 0, 1).oro).toBeGreaterThan(premioCombate(1, 'duelo', 0, 1).oro);
    expect(premioCombate(5, 'duelo', 100, 1).fama).toBeGreaterThan(premioCombate(5, 'duelo', 0, 1).fama);
  });

  it('arenas con apariciones lejos del inicio', () => {
    for (let s = 1; s < 12; s++) {
      const a = generarArena(s, s * 3, s % 4 === 0);
      expect(a.apariciones.length).toBeGreaterThanOrEqual(5);
      for (const p of a.apariciones) expect(Math.hypot(p.x - a.inicio.x, p.z - a.inicio.z)).toBeGreaterThan(7);
      for (const t of a.trampas) expect(Math.hypot(t.x - a.inicio.x, t.z - a.inicio.z)).toBeGreaterThan(t.r + 2);
    }
  });
});

describe('controles', () => {
  it('mando: botones estándar y zona muerta', () => {
    expect(accionesMando((i) => i === 2)).toEqual(['ligero']);
    expect(accionesMando((i) => i === 5).includes('bloqueo')).toBe(true);
    expect(accionesMando((i) => i === 9)).toEqual(['pausa']);
    expect(zonaMuerta(0.1, 0.1)).toEqual([0, 0]);
    const [x] = zonaMuerta(1, 0);
    expect(x).toBeCloseTo(1);
  });

  it('combina las fuentes: dirección de la primera que se mueve y acciones sumadas', () => {
    const c = new Controles();
    c.actualizar([{ x: 0, y: 0, camX: 0, camY: 0, activas: [] }, { x: 1, y: 1, camX: 0.5, camY: 0, activas: ['ligero'] }, { x: -1, y: 0, camX: 0, camY: 0, activas: ['bloqueo'] }]);
    expect(c.x).toBeCloseTo(Math.SQRT1_2);
    expect(c.camX).toBe(0.5);
    expect(c.pulsado('ligero')).toBe(true);
    expect(c.activo('bloqueo')).toBe(true);
    c.actualizar([{ x: 0, y: 0, camX: 0, camY: 0, activas: ['ligero'] }]);
    expect(c.pulsado('ligero')).toBe(false);
    expect(c.activo('ligero')).toBe(true);
    expect(c.soltado('bloqueo')).toBe(true);
  });
});

/** Jugador automático sencillo: se acerca, ataca, esquiva los rojos, se cubre de los demás y remata. */
function piloto(p: Partida, rng: () => number): ControlesPartida {
  const c = controlesVacios();
  const j = p.jugador;
  const e = p.masCercano(40);
  if (!e) return c;
  const d = Math.hypot(e.cuerpo.x - j.cuerpo.x, e.cuerpo.z - j.cuerpo.z);
  p.camYaw = yawHacia(j.cuerpo.x, j.cuerpo.z, e.cuerpo.x, e.cuerpo.z);
  const peligro = p.vivos.find((o) => o.estado === 'aviso' && o.ataque && Math.hypot(o.cuerpo.x - j.cuerpo.x, o.cuerpo.z - j.cuerpo.z) < o.ataque.alcance + 1.5 && o.t > p.avisoDe(o, o.ataque) - 0.25);
  if (peligro?.ataque?.color === 'rojo') {
    c.esquivar = true;
    c.x = 1;
  } else if (peligro) c.bloquear = true;
  else if (d > 2.2) c.z = -1;
  else c.ligero = rng() < 0.5;
  if (p.rematable()) c.ligero = true;
  if (j.fervor >= 100) c.gloria = true;
  return c;
}

const opciones = (n: number, semilla: number) => {
  const equipo = equipoInicial();
  const atributos = { ...atributosIniciales(), vida: 8, fuerza: 8, aguante: 6 };
  return { modo: MODOS.muyFacil, combate: generarCombate(n), stats: calcularStats(atributos, equipo, { id: 'gladius' as const, nivel: 3 }), equipo, arma: { id: 'gladius' as const, nivel: 3 }, semilla };
};

describe('partida', () => {
  it('se gana un combate y se cobra el premio', () => {
    const rng = crearRng(1);
    let ganados = 0;
    for (const n of [1, 2, 3]) {
      let resumen = null as Partida['resumen'];
      const p = new Partida({ ...opciones(n, n * 7), eventos: { fin: (r) => (resumen = r) } });
      for (let i = 0; i < 60 * 60 * 4 && p.fase !== 'fin'; i++) p.actualizar(PASO, piloto(p, rng.siguiente));
      expect(p.fase).toBe('fin');
      expect(resumen).not.toBeNull();
      if (resumen!.victoria) {
        ganados++;
        expect(resumen!.oro).toBeGreaterThan(0);
        expect(p.bajas).toBe(p.combate.oleadas.flat().length);
      }
    }
    expect(ganados).toBeGreaterThanOrEqual(2);
  });

  it('el bloqueo perfecto aturde, el rojo no se bloquea y sin estamina se rompe la guardia', () => {
    const p = new Partida(opciones(4, 4));
    const j = p.jugador;
    const e = p.rivales[0];
    j.bloqueando = true;
    j.bloqueoT = 0.05;
    j.yaw = yawHacia(j.cuerpo.x, j.cuerpo.z, e.cuerpo.x, e.cuerpo.z);
    const vida = j.vida;
    expect(p.golpearJugador(20, 'azul', e.cuerpo.x, e.cuerpo.z, e)).toBe('parry');
    expect(j.vida).toBe(vida);
    expect(j.contraT).toBeGreaterThan(0);
    expect(['tambaleo', 'aturdido']).toContain(e.estado);
    expect(p.golpearJugador(20, 'rojo', e.cuerpo.x, e.cuerpo.z, e)).toBe('golpe');
    expect(j.vida).toBeLessThan(vida);
    j.estado = 'libre';
    j.bloqueando = true;
    j.bloqueoT = 2;
    j.estamina = 5;
    expect(p.golpearJugador(20, 'amarillo', e.cuerpo.x, e.cuerpo.z, e)).toBe('bloqueo');
    expect(j.estado).toBe('guardiaRota');
  });

  it('el fuerte se carga y sin estamina no se ataca', () => {
    const p = new Partida(opciones(1, 2));
    const j = p.jugador;
    p.actualizar(PASO, { ...controlesVacios(), fuerte: true });
    expect(j.estado).toBe('cargando');
    for (let i = 0; i < 30; i++) p.actualizar(PASO, { ...controlesVacios(), fuerte: true });
    p.actualizar(PASO, controlesVacios());
    expect(j.estado).toBe('atacando');
    expect(j.carga).toBeGreaterThan(1.3);
    j.estado = 'libre';
    j.estamina = 0;
    j.desdeGasto = 0;
    p.actualizar(PASO, { ...controlesVacios(), ligero: true });
    expect(j.estado).toBe('libre');
    expect(p.sinAliento).toBeGreaterThan(0);
  });

  it('los golpes desgastan la armadura y el golpe de gloria vacía el fervor', () => {
    const p = new Partida(opciones(1, 3));
    const antes = p.equipo.torso!.durabilidad;
    for (let i = 0; i < 40; i++) {
      p.jugador.invul = 0;
      p.jugador.estado = 'libre';
      p.jugador.vida = 1000;
      p.golpearJugador(10, 'rojo', 0, 0, null);
    }
    expect(p.equipo.torso!.durabilidad).toBeLessThan(antes);
    p.jugador.fervor = 100;
    p.actualizar(PASO, { ...controlesVacios(), gloria: true });
    expect(p.jugador.fervor).toBe(0);
    expect(p.jugador.golpe?.arco).toBeCloseTo(Math.PI * 2);
    expect(ARMAS.tridente.efecto).toBe('red');
  });
});

describe('guardado', () => {
  it('normaliza datos dañados y cobra al ganar', () => {
    const g = normalizarGuardado({ oro: 50, combate: -3, arma: { id: 'espada-laser', nivel: 9 }, atributos: { fuerza: 3, raro: 9 }, equipo: { torso: { nivel: 2, defensa: 99, durabilidad: 9999 } }, look: { gender: 'alien' } });
    expect(g.combate).toBe(1);
    expect(g.arma.id).toBe('gladius');
    expect(g.atributos.fuerza).toBe(3);
    expect(g.equipo.torso!.defensa).toBeLessThan(0.6);
    expect(g.equipo.torso!.durabilidad).toBe(g.equipo.torso!.durMax);
    expect(g.equipo.cabeza).toBeNull();
    expect(g.look.gender).toBe('boy');
    anotarCombate(g, { victoria: true, bajas: 2, oro: 30, fama: 10, perfectos: 1, campeon: false }, 'a');
    expect(g.oro).toBe(80);
    expect(g.combate).toBe(2);
    expect(g.records[0].combate).toBe(1);
    anotarCombate(g, { victoria: false, bajas: 0, oro: 0, fama: 0, perfectos: 0, campeon: false }, 'a');
    expect(g.combate).toBe(2);
    expect(g.estadisticas.derrotas).toBe(1);
    expect(guardadoNuevo().combate).toBe(1);
  });

  it('configuración: controles táctiles por defecto y valores raros', () => {
    expect(normalizarConfig({}).pantallaCompleta).toBe(true);
    expect(normalizarConfig({}).controles).toBe('completo');
    expect(normalizarConfig({ controles: 'joystick' }).controles).toBe('completo');
    expect(normalizarConfig({ controles: 'psp' }).controles).toBe('psp');
  });
});
