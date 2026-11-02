import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { IdArma } from '../core/armas';
import { crearRng } from '../core/rng';
import type { ArmaRival, ColorAtaque } from '../core/rivales';
import { liberar } from '../rendimiento';
import { animateWalk, createAvatar, DEFAULT_LOOK, LOOK_OPTIONS, type Look } from './characters';
import { Partida, type Efecto, type Rival } from './logica';

const cacheMat = new Map<string, THREE.Material>();
function mat(color: number, basico = false, opacidad = 1): THREE.Material {
  const clave = `${color}|${basico}|${opacidad}`;
  let m = cacheMat.get(clave);
  if (!m) {
    const o = { color, transparent: opacidad < 1, opacity: opacidad, depthWrite: opacidad >= 1 };
    m = basico ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o);
    cacheMat.set(clave, m);
  }
  return m;
}

function malla(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, sombra = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

const COLOR_AVISO: Record<ColorAtaque, number> = { amarillo: 0xffd23f, rojo: 0xff3030, azul: 0x3cb4ff };
const ACERO = 0xc9d1d9;
const MADERA = 0x6d4c41;

/* ---------- Armas y escudo ---------- */

function modeloGladius(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.BoxGeometry(0.07, 0.6, 0.02), mat(ACERO), 0, 0.22, 0));
  g.add(malla(new THREE.ConeGeometry(0.05, 0.12, 4), mat(ACERO), 0, 0.58, 0));
  g.add(malla(new THREE.BoxGeometry(0.2, 0.05, 0.06), mat(0xb08d57), 0, -0.1, 0));
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), mat(MADERA), 0, -0.22, 0));
  return g;
}

function modeloLanza(tridente: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.025, 0.03, 2, 6), mat(MADERA), 0, 0.4, 0));
  if (tridente) {
    for (const s of [-1, 0, 1]) g.add(malla(new THREE.ConeGeometry(0.03, 0.35, 4), mat(ACERO), s * 0.09, 1.55, 0));
    g.add(malla(new THREE.BoxGeometry(0.24, 0.04, 0.04), mat(ACERO), 0, 1.38, 0));
  } else g.add(malla(new THREE.ConeGeometry(0.06, 0.32, 4), mat(ACERO), 0, 1.55, 0));
  return g;
}

function modeloHacha(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.035, 0.85, 6), mat(MADERA), 0, 0.1, 0));
  const hoja = new THREE.Shape();
  hoja.moveTo(0, 0);
  hoja.quadraticCurveTo(0.3, 0.05, 0.32, 0.3);
  hoja.quadraticCurveTo(0.16, 0.2, 0, 0.18);
  hoja.closePath();
  g.add(malla(new THREE.ExtrudeGeometry(hoja, { depth: 0.03, bevelEnabled: false }), mat(ACERO), 0.02, 0.3, -0.015));
  return g;
}

function modeloMaza(): THREE.Group {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 6), mat(MADERA), 0, 0.05, 0));
  g.add(malla(new THREE.DodecahedronGeometry(0.15, 0), mat(0x8a8f96), 0, 0.45, 0));
  return g;
}

function modeloArco(): THREE.Object3D {
  const m = malla(new THREE.TorusGeometry(0.42, 0.025, 4, 12, Math.PI), mat(MADERA), 0, 0, 0);
  m.rotation.z = Math.PI / 2;
  return m;
}

function modeloArma(id: IdArma | ArmaRival): THREE.Object3D | null {
  switch (id) {
    case 'gladius':
    case 'dosEspadas':
      return modeloGladius();
    case 'lanza':
      return modeloLanza(false);
    case 'tridente':
      return modeloLanza(true);
    case 'hacha':
      return modeloHacha();
    case 'maza':
      return modeloMaza();
    case 'arco':
      return modeloArco();
    default:
      return null;
  }
}

/** Escudo: redondo (parma) o rectangular (scutum), con el color del dueño. */
function modeloEscudo(color: number, grande: boolean): THREE.Group {
  const g = new THREE.Group();
  if (grande) {
    g.add(malla(new THREE.BoxGeometry(0.06, 0.95, 0.62), mat(color), 0, 0, 0));
    g.add(malla(new THREE.BoxGeometry(0.07, 0.99, 0.05), mat(0xb08d57), 0, 0, 0));
  } else {
    g.add(malla(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 14).rotateZ(Math.PI / 2), mat(color), 0, 0, 0));
    g.add(malla(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 14, 1, true).rotateZ(Math.PI / 2), mat(0xb08d57), 0, 0, 0));
  }
  g.add(malla(new THREE.SphereGeometry(0.08, 8, 6), mat(0xd4b26a), 0.05, 0, 0));
  return g;
}

function ojos(g: THREE.Object3D, x: number, y: number, z: number, sep: number, color: number, r = 0.05) {
  for (const s of [-1, 1]) g.add(malla(new THREE.SphereGeometry(r, 8, 6), mat(color, true), x + s * sep, y, z, false));
}

/** Fiera cuadrúpeda low-poly (lobo, león, oso o toro), mirando a -z. */
function modeloFiera(tipo: Rival['tipo'], id: number): { grupo: THREE.Group; patas: THREE.Object3D[] } {
  const g = new THREE.Group();
  const color = tipo === 'lobo' ? [0x8d8d8d, 0x6d6158, 0xbdbdbd][id % 3] : tipo === 'leon' ? 0xd4a24c : tipo === 'oso' ? 0x5d4030 : 0x3e2a20;
  const pelo = mat(color);
  const ancho = tipo === 'oso' ? 0.75 : tipo === 'toro' ? 0.7 : 0.5;
  const largo = tipo === 'lobo' ? 1.2 : 1.35;
  const altoCuerpo = tipo === 'oso' || tipo === 'toro' ? 0.7 : 0.5;
  g.add(malla(new THREE.BoxGeometry(ancho, altoCuerpo, largo), pelo, 0, 0.75 + altoCuerpo * 0.1, 0));
  const cabeza = tipo === 'toro' ? 0.5 : 0.42;
  g.add(malla(new THREE.BoxGeometry(cabeza, cabeza, cabeza), pelo, 0, 0.98, -largo / 2 - 0.12));
  g.add(malla(new THREE.BoxGeometry(0.24, 0.2, 0.3), mat(tipo === 'toro' ? 0x2a1a14 : 0x9e9e9e), 0, 0.88, -largo / 2 - 0.42));
  ojos(g, 0, 1.06, -largo / 2 - 0.34, 0.12, tipo === 'toro' ? 0xff4a3a : 0xffd23f, 0.045);
  if (tipo === 'leon') g.add(malla(new THREE.DodecahedronGeometry(0.42, 0), mat(0x8a5a2a), 0, 1.0, -largo / 2 - 0.02));
  if (tipo === 'toro') for (const s of [-1, 1]) {
    const cuerno = malla(new THREE.ConeGeometry(0.06, 0.4, 5), mat(0xf2e8d0), s * 0.3, 1.2, -largo / 2 - 0.15);
    cuerno.rotation.z = -s * 1.1;
    g.add(cuerno);
  }
  if (tipo === 'lobo' || tipo === 'oso') for (const s of [-1, 1]) g.add(malla(new THREE.ConeGeometry(0.08, 0.18, 4), pelo, s * 0.14, 1.26, -largo / 2 - 0.1));
  if (tipo !== 'oso') {
    const cola = malla(new THREE.CylinderGeometry(0.04, 0.08, 0.6, 5), pelo, 0, 0.95, largo / 2 + 0.15);
    cola.rotation.x = -0.9;
    g.add(cola);
  }
  const patas: THREE.Object3D[] = [];
  const grosor = tipo === 'oso' || tipo === 'toro' ? 0.2 : 0.13;
  for (const [x, z] of [[-ancho * 0.36, -largo * 0.36], [ancho * 0.36, -largo * 0.36], [-ancho * 0.36, largo * 0.36], [ancho * 0.36, largo * 0.36]]) {
    const pivote = new THREE.Group();
    pivote.position.set(x, 0.62, z);
    pivote.add(malla(new THREE.BoxGeometry(grosor, 0.62, grosor), pelo, 0, -0.31, 0));
    g.add(pivote);
    patas.push(pivote);
  }
  return { grupo: g, patas };
}

/** Apariencia de un gladiador rival: al azar pero siempre la misma para el mismo id. */
function lookRival(tipo: Rival['tipo'], id: number, campeon: boolean): Look {
  const rng = crearRng(id * 977 + 3);
  const pick = <T>(lista: readonly T[]) => lista[Math.floor(rng.siguiente() * lista.length)];
  const ids = (k: keyof typeof LOOK_OPTIONS) => (LOOK_OPTIONS[k] as readonly ({ id: string } | number)[]).map((o) => (typeof o === 'object' ? o.id : o));
  const casco = tipo === 'murmillo' || tipo === 'hoplomaco' || campeon;
  return {
    ...DEFAULT_LOOK,
    skin: pick(LOOK_OPTIONS.skin),
    hair: pick(ids('hair')) as Look['hair'],
    hairColor: pick(LOOK_OPTIONS.hairColor),
    facialHair: pick(['none', 'stubble', 'beard', 'mustache']) as Look['facialHair'],
    body: tipo === 'murmillo' || campeon ? 'strong' : pick(['slim', 'normal', 'strong']) as Look['body'],
    shirt: campeon ? 0xffb300 : pick([0x5d4037, 0x37474f, 0x6d4c41, 0x1b5e20, 0x4a148c, 0x0d47a1]),
    bottom: 'skirt',
    bottomColor: pick([0x8d6e63, 0x5d4037, 0x9e9e9e]),
    hat: campeon ? 'crown' : casco ? 'helmet' : 'none',
    hatColor: 0xb0a080,
    accessory: 'none',
    gender: 'boy',
    eyes: 'normal',
  };
}

interface Modelo {
  grupo: THREE.Group;
  /** Modelo interior que se anima (el contenedor lleva posición, anillo y estados). */
  interior: THREE.Group;
  /** Avatar del Arcade (gladiadores) o null en las fieras. */
  cuerpo: THREE.Group | null;
  brazos: THREE.Object3D[];
  patas: THREE.Object3D[];
  anillo: THREE.Mesh;
  estrellas: THREE.Group;
  red: THREE.Mesh;
}

export class Render3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly camara = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
  private escena = new THREE.Scene();
  private estatico = new THREE.Group();
  private version = -1;
  private jugador: Modelo | null = null;
  private claveJugador = '';
  private rivales = new Map<Rival, Modelo>();
  private areas: THREE.Mesh[] = [];
  private proyectiles: THREE.Object3D[] = [];
  private tiposProyectil: string[] = [];
  private efectos = new Map<Efecto, THREE.Object3D>();
  private marcaFijado: THREE.Mesh;
  private sol: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private tamSombras = -1;
  private vp = new THREE.Vector3();
  private miraX = 0;
  private miraZ = 0;

  constructor(lienzo: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.hemi = new THREE.HemisphereLight(0xeaf4ff, 0x665544, 1.4);
    this.sol = new THREE.DirectionalLight(0xfff1d6, 1.7);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sol.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
    this.sol.position.set(14, 40, 10);
    this.escena.add(this.hemi, this.sol, this.estatico, this.camara);
    this.marcaFijado = malla(new THREE.TorusGeometry(0.7, 0.04, 4, 24).rotateX(Math.PI / 2), mat(0xffffff, true, 0.8), 0, 0.05, 0, false);
    this.escena.add(this.marcaFijado);
  }

  sombras(tam: number) {
    if (tam === this.tamSombras) return;
    this.tamSombras = tam;
    this.renderer.shadowMap.enabled = tam > 0;
    if (tam > 0) {
      this.sol.shadow.mapSize.set(tam, tam);
      this.sol.shadow.map?.dispose();
      this.sol.shadow.map = null;
    }
    this.escena.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  ajustar(ancho: number, alto: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  /** Arena nueva: suelo, muro, gradas con público (o empalizada), obstáculos, trampas y antorchas. */
  private construirArena(p: Partida) {
    liberar(this.estatico);
    this.estatico.clear();
    for (const m of this.rivales.values()) {
      this.escena.remove(m.grupo);
      liberar(m.grupo);
    }
    this.rivales.clear();
    const t = p.tema;
    const a = p.arena;
    this.escena.background = new THREE.Color(t.cielo);
    this.escena.fog = new THREE.Fog(t.niebla, 30, 90);
    this.hemi.color.setHex(t.luz);
    this.hemi.intensity = t.antorchas && t.cielo < 0x303030 ? 0.9 : 1.4;
    const rng = crearRng(p.version * 13 + 1);

    const porMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const fijo = (...ms: THREE.Mesh[]) => {
      for (const m of ms) {
        m.updateMatrix();
        m.geometry.applyMatrix4(m.matrix);
        const material = m.material as THREE.Material;
        if (!porMaterial.has(material)) porMaterial.set(material, []);
        porMaterial.get(material)!.push(m.geometry);
      }
    };
    const suelo = malla(new THREE.CircleGeometry(a.radio + 0.5, 48).rotateX(-Math.PI / 2), mat(t.suelo), 0, 0, 0);
    suelo.castShadow = false;
    this.estatico.add(suelo);
    fijo(malla(new THREE.RingGeometry(1.8, 2.1, 32).rotateX(-Math.PI / 2), mat(t.piedra), 0, 0.02, 0));

    // Muro del borde y, detrás, gradas con público o una empalizada.
    const R = a.radio + 0.5;
    fijo(malla(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 2.2, 48, 1, true), mat(t.piedra), 0, 1.1, 0));
    if (t.gradas) {
      for (let k = 0; k < 5; k++) {
        const r = R + 1 + k * 1.4;
        const h = 2.2 + k * 1.1;
        fijo(malla(new THREE.CylinderGeometry(r + 1.4, r + 1.4, h, 48, 1, true), mat(t.piedra), 0, h / 2, 0));
        fijo(malla(new THREE.RingGeometry(r, r + 1.4, 48).rotateX(-Math.PI / 2), mat(t.piedra), 0, h, 0));
        // Público: figuras sencillas de colores, de pie en cada fila.
        const n = Math.round(r * 3.2);
        for (let i = 0; i < n; i++) {
          if (rng.siguiente() < 0.25) continue;
          const ang = (i / n) * Math.PI * 2 + rng.rango(-0.02, 0.02);
          const rr = r + 0.7;
          const color = rng.elegir([0xb71c1c, 0x1565c0, 0xf9a825, 0x2e7d32, 0xeeeeee, 0x6a1b9a, 0x795548]);
          fijo(malla(new THREE.BoxGeometry(0.42, 0.7, 0.32), mat(color), Math.cos(ang) * rr, h + 0.35, Math.sin(ang) * rr));
          fijo(malla(new THREE.BoxGeometry(0.26, 0.26, 0.26), mat(0xe0b088), Math.cos(ang) * rr, h + 0.86, Math.sin(ang) * rr));
        }
      }
    } else {
      for (let i = 0; i < 70; i++) {
        const ang = (i / 70) * Math.PI * 2;
        fijo(malla(new THREE.CylinderGeometry(0.18, 0.2, 3.4, 6), mat(t.madera), Math.cos(ang) * (R + 0.7), 1.7, Math.sin(ang) * (R + 0.7)));
      }
    }
    for (const bl of a.bloques) {
      const alto = bl.y1 - bl.y0;
      if (bl.tipo === 'torre') {
        // Columna con base y capitel.
        fijo(malla(new THREE.CylinderGeometry(0.5, 0.56, alto, 10), mat(t.piedra), bl.x, alto / 2, bl.z));
        fijo(malla(new THREE.BoxGeometry(1.3, 0.3, 1.3), mat(t.piedra), bl.x, alto, bl.z), malla(new THREE.BoxGeometry(1.3, 0.3, 1.3), mat(t.piedra), bl.x, 0.15, bl.z));
      } else if (bl.tipo === 'caja') {
        // Carro volcado: caja de madera con ruedas.
        fijo(malla(new THREE.BoxGeometry(bl.w, alto * 0.75, bl.d), mat(t.madera), bl.x, alto * 0.45, bl.z));
        for (const s of [-1, 1]) for (const k of [-1, 1]) {
          fijo(malla(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 10).rotateZ(Math.PI / 2), mat(0x4e342e), bl.x + s * (bl.w / 2 + 0.06), 0.42, bl.z + k * bl.d * 0.3));
        }
      } else fijo(malla(new THREE.BoxGeometry(bl.w, alto, bl.d), mat(t.piedra), bl.x, alto / 2, bl.z));
    }
    // Trampas: foso oscuro con pinchos.
    for (const tr of a.trampas) {
      fijo(malla(new THREE.CircleGeometry(tr.r, 20).rotateX(-Math.PI / 2), mat(0x2a1e14), tr.x, 0.03, tr.z));
      const n = Math.round(tr.r * 6);
      for (let i = 0; i < n; i++) {
        const ang = rng.siguiente() * Math.PI * 2;
        const r = Math.sqrt(rng.siguiente()) * tr.r * 0.85;
        fijo(malla(new THREE.ConeGeometry(0.07, 0.45, 4), mat(0x9aa0a6), tr.x + Math.cos(ang) * r, 0.22, tr.z + Math.sin(ang) * r));
      }
    }
    if (t.antorchas) {
      for (const d of a.adornos) {
        fijo(malla(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), mat(MADERA), d.x, 2.6, d.z));
        fijo(malla(new THREE.ConeGeometry(0.16, 0.4, 6), mat(0xffa030, true), d.x, 3.35, d.z));
      }
    }
    for (const [material, geos] of porMaterial) {
      const conIndice = geos.filter((g) => g.index);
      const sinIndice = geos.filter((g) => !g.index);
      for (const lista of [conIndice, sinIndice]) if (lista.length) this.estatico.add(malla(mergeGeometries(lista), material));
      for (const g of geos) g.dispose();
    }
  }

  private extras(grupo: THREE.Group, interior: THREE.Group, radio: number, alto: number): Pick<Modelo, 'anillo' | 'estrellas' | 'red'> {
    const anillo = malla(new THREE.RingGeometry(radio + 0.15, radio + 0.4, 28).rotateX(-Math.PI / 2), mat(0xffd23f, true, 0.9), 0, 0.06, 0, false);
    anillo.visible = false;
    const estrellas = new THREE.Group();
    for (let i = 0; i < 3; i++) estrellas.add(malla(new THREE.OctahedronGeometry(0.09, 0), mat(0xffe27a, true), Math.cos((i / 3) * Math.PI * 2) * 0.35, 0, Math.sin((i / 3) * Math.PI * 2) * 0.35, false));
    estrellas.position.y = alto + 0.25;
    estrellas.visible = false;
    // Red encima (atrapado).
    const red = malla(new THREE.SphereGeometry(radio + 0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, wireframe: true }), 0, 0, 0, false);
    red.scale.y = (alto + 0.2) / (radio + 0.35);
    red.visible = false;
    grupo.add(anillo, estrellas, red);
    void interior;
    return { anillo, estrellas, red };
  }

  private modeloRival(r: Rival): Modelo {
    let m = this.rivales.get(r);
    if (m) return m;
    const contenedor = new THREE.Group();
    let interior: THREE.Group;
    let cuerpo: THREE.Group | null = null;
    let brazos: THREE.Object3D[] = [];
    let patas: THREE.Object3D[] = [];
    if (r.d.fiera) {
      const f = modeloFiera(r.tipo, r.id);
      interior = f.grupo;
      patas = f.patas;
      // Las fieras se modelan mirando a -z y los avatares a +z: se voltean.
      interior.rotation.order = 'YXZ';
      interior.rotation.y = Math.PI;
    } else {
      const a = createAvatar(lookRival(r.tipo, r.id, r.campeon));
      interior = a.group;
      cuerpo = a.body;
      brazos = a.body.userData.arms as THREE.Object3D[];
      const arma = modeloArma(r.d.arma);
      if (arma) {
        arma.position.set(0, -0.48, 0.12);
        arma.rotation.x = Math.PI / 2;
        brazos[1].add(arma);
      }
      if (r.d.arma === 'dosEspadas') {
        const otra = modeloGladius();
        otra.position.set(0, -0.48, 0.12);
        otra.rotation.x = Math.PI / 2;
        brazos[0].add(otra);
      }
      if (r.d.escudo) {
        const escudo = modeloEscudo(r.campeon ? 0xffb300 : 0x8e2a2a, r.tipo === 'murmillo');
        escudo.position.set(-0.12, -0.35, 0.1);
        brazos[0].add(escudo);
      }
    }
    interior.scale.multiplyScalar(r.d.escala * (r.campeon ? 1.12 : 1));
    contenedor.add(interior);
    m = { grupo: contenedor, interior, cuerpo, brazos, patas, ...this.extras(contenedor, interior, r.d.radio, 1.9 * r.d.escala) };
    this.rivales.set(r, m);
    this.escena.add(contenedor);
    return m;
  }

  private modeloJugador(p: Partida, look: Look): Modelo {
    const conCasco = !!p.equipo.cabeza && p.equipo.cabeza.durabilidad > 0;
    const conEscudo = !!p.equipo.escudo && p.equipo.escudo.durabilidad > 0;
    const clave = JSON.stringify(look) + p.arma.id + conCasco + conEscudo;
    if (this.jugador && clave === this.claveJugador) return this.jugador;
    if (this.jugador) {
      this.escena.remove(this.jugador.grupo);
      liberar(this.jugador.grupo);
    }
    this.claveJugador = clave;
    const a = createAvatar(conCasco ? { ...look, hat: 'helmet', hatColor: 0xb0a080 } : look);
    const brazos = a.body.userData.arms as THREE.Object3D[];
    if (conEscudo) {
      const escudo = modeloEscudo(0x8e2a2a, (p.equipo.escudo?.nivel ?? 1) >= 4);
      escudo.position.set(-0.12, -0.35, 0.1);
      brazos[0].add(escudo);
    }
    const arma = modeloArma(p.arma.id);
    if (arma) {
      arma.position.set(0, -0.48, 0.12);
      arma.rotation.x = Math.PI / 2;
      brazos[1].add(arma);
    }
    const m: Modelo = { grupo: a.group, interior: a.group, cuerpo: a.body, brazos, patas: [], ...this.extras(a.group, a.group, 0.4, 1.9) };
    this.jugador = m;
    this.escena.add(a.group);
    return m;
  }

  dibujar(p: Partida, look: Look, efectos: boolean, dt: number) {
    if (p.version !== this.version) {
      this.version = p.version;
      this.construirArena(p);
    }
    const j = p.jugador;
    const mj = this.modeloJugador(p, look);
    this.animarJugador(p, mj);

    // Cámara detrás del gladiador; con un objetivo fijado mira entre los dos.
    const dist = 7.2;
    const cp = Math.cos(p.camPitch);
    let mx = j.cuerpo.x;
    let mz = j.cuerpo.z;
    if (p.fijado) {
      mx = (j.cuerpo.x * 2 + p.fijado.cuerpo.x) / 3;
      mz = (j.cuerpo.z * 2 + p.fijado.cuerpo.z) / 3;
    }
    const k = Math.min(1, dt * 6);
    this.miraX += (mx - this.miraX) * k;
    this.miraZ += (mz - this.miraZ) * k;
    if (Math.hypot(this.miraX - mx, this.miraZ - mz) > 8) {
      this.miraX = mx;
      this.miraZ = mz;
    }
    this.camara.position.set(j.cuerpo.x + Math.sin(p.camYaw) * dist * cp, 1.4 + dist * Math.sin(p.camPitch), j.cuerpo.z + Math.cos(p.camYaw) * dist * cp);
    this.camara.lookAt(this.miraX, 1.3, this.miraZ);
    this.sol.position.set(j.cuerpo.x + 14, 40, j.cuerpo.z + 10);
    this.sol.target.position.set(j.cuerpo.x, 0, j.cuerpo.z);
    this.sol.target.updateMatrixWorld();

    const presentes = new Set(p.rivales);
    for (const [r, m] of this.rivales) {
      if (!presentes.has(r)) {
        this.escena.remove(m.grupo);
        liberar(m.grupo);
        this.rivales.delete(r);
      }
    }
    for (const r of p.rivales) this.animarRival(p, r, this.modeloRival(r));

    this.marcaFijado.visible = !!p.fijado;
    if (p.fijado) {
      this.marcaFijado.position.set(p.fijado.cuerpo.x, 0.05, p.fijado.cuerpo.z);
      this.marcaFijado.scale.setScalar(p.fijado.d.radio + 0.5);
      this.marcaFijado.rotation.y = p.tiempo * 2;
    }

    this.dibujarAreas(p);
    this.dibujarProyectiles(p);
    this.dibujarEfectos(p, efectos);
    this.renderer.render(this.escena, this.camara);
  }

  private animarJugador(p: Partida, m: Modelo) {
    const j = p.jugador;
    m.grupo.position.set(j.cuerpo.x, j.cuerpo.y, j.cuerpo.z);
    m.grupo.rotation.set(0, j.yaw + Math.PI, 0);
    const [izq, der] = m.brazos;
    const cuerpo = m.cuerpo!;
    animateWalk(cuerpo, p.tiempo * 1.4, j.moviendose && j.estado === 'libre');
    cuerpo.rotation.x = 0;
    cuerpo.position.y = 0;
    if (j.estado === 'muerto') {
      cuerpo.rotation.x = Math.PI / 2;
      cuerpo.position.y = 0.2;
    }
    // Escudo arriba al bloquear; ataque: brazo derecho de atrás hacia delante.
    izq.rotation.set(j.bloqueando ? -1.5 : -0.3, 0, j.bloqueando ? 0.6 : 0.15);
    if (j.estado === 'atacando' && j.golpe) {
      const fr = Math.min(1, j.t / j.golpe.duracion);
      const ataque = fr < j.golpe.impacto ? -2.6 * (fr / j.golpe.impacto) : -2.6 + (fr - j.golpe.impacto) * 3.6;
      der.rotation.set(ataque, 0, j.combo % 2 ? -0.6 : 0.4);
      if (j.golpe.arco >= Math.PI * 2 - 0.01) m.grupo.rotation.y += fr * Math.PI * 2;
    } else if (j.estado === 'cargando') {
      // Brazo atrás, temblando al cargar del todo.
      const k = Math.min(1, j.t);
      der.rotation.set(-2.4 - k * 0.5 + (k >= 1 ? Math.sin(p.tiempo * 60) * 0.05 : 0), 0, 0.3);
      cuerpo.rotation.x = -0.1 * k;
    } else if (j.estado === 'rematando') {
      der.rotation.set(-2.8 + (1 - j.t / 0.75) * 2.4, 0, 0);
    } else if (j.estado === 'guardiaRota') {
      izq.rotation.set(0.2, 0, 0.5);
      der.rotation.set(0.2, 0, -0.5);
      cuerpo.rotation.x = 0.2;
    } else {
      der.rotation.set(-0.5, 0, -0.1);
    }
    // Rodada al esquivar.
    if (j.estado === 'esquivando') {
      cuerpo.rotation.x = -(j.t / 0.36) * Math.PI * 2;
      cuerpo.position.y = 0.3;
    }
    m.anillo.visible = j.contraT > 0 || j.fervor >= 100;
    if (m.anillo.visible) (m.anillo.material as THREE.MeshBasicMaterial).color.setHex(j.contraT > 0 ? 0x6fd8ff : 0xff7a2a);
    m.estrellas.visible = j.estado === 'tambaleo' || j.estado === 'guardiaRota';
    m.estrellas.rotation.y = p.tiempo * 6;
    m.red.visible = j.estado === 'atrapado';
  }

  private animarRival(p: Partida, r: Rival, m: Modelo) {
    const interior = m.interior;
    m.grupo.position.set(r.cuerpo.x, r.cuerpo.y, r.cuerpo.z);
    m.grupo.rotation.set(0, r.yaw + Math.PI, 0);
    m.estrellas.visible = r.estado === 'aturdido';
    m.estrellas.rotation.y = p.tiempo * 5;
    m.red.visible = r.estado === 'atrapado';
    const avisando = r.estado === 'aviso' && !!r.ataque;
    m.anillo.visible = avisando || r.campeon;
    if (avisando) {
      (m.anillo.material as THREE.MeshBasicMaterial).color.setHex(COLOR_AVISO[r.ataque!.color]);
      m.anillo.scale.setScalar(1 + Math.sin(p.tiempo * 20) * 0.08);
    } else if (r.campeon) {
      (m.anillo.material as THREE.MeshBasicMaterial).color.setHex(0xffb300);
      m.anillo.scale.setScalar(1);
    }
    // Aparecen saliendo por las puertas (suben desde el suelo).
    interior.position.y = r.estado === 'aparecer' ? -1.8 * r.d.escala * Math.min(1, r.t / 0.9) : 0;
    if (r.estado === 'muerto') {
      const k = Math.min(1, r.muerteT * 2.5);
      interior.rotation.x = (-Math.PI / 2) * k;
      interior.position.y = -Math.max(0, r.muerteT - 0.8) * 1.2;
      return;
    }
    interior.rotation.x = r.estado === 'tambaleo' ? 0.25 : 0;
    const anda = r.estado === 'mover' || r.estado === 'embestida' || r.estado === 'esquivando';
    const t = p.tiempo * (r.estado === 'embestida' ? 3 : 1.4) + r.id;
    if (m.cuerpo) {
      animateWalk(m.cuerpo, t, anda);
      const [izq, der] = m.brazos;
      if (r.estado === 'aviso' && r.ataque) {
        const fr = r.t / p.avisoDe(r, r.ataque);
        der.rotation.set(-0.6 - fr * 2.2, 0, 0.3);
        izq.rotation.set(r.d.escudo ? -1.4 : -0.4 - fr, 0, 0.3);
      } else if (r.estado === 'recuperar') {
        der.rotation.set(-0.3, 0, 0.2);
      } else {
        der.rotation.set(-0.9, 0, 0.1);
        izq.rotation.set(r.d.escudo ? -1.4 : -0.4, 0, r.d.escudo ? 0.6 : 0.1);
      }
    } else {
      for (let i = 0; i < m.patas.length; i++) m.patas[i].rotation.x = anda ? Math.sin(t * 5 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0;
      // Se agachan antes de saltar o embestir.
      if (r.estado === 'aviso') interior.rotation.x = -0.25;
    }
  }

  private dibujarAreas(p: Partida) {
    while (this.areas.length < p.areas.length) {
      const g = malla(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.07, 0, false);
      g.add(malla(new THREE.RingGeometry(0.93, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.01, 0, false));
      this.areas.push(g);
      this.escena.add(g);
    }
    this.areas.forEach((m, i) => {
      const a = p.areas[i];
      m.visible = !!a;
      if (!a) return;
      const color = COLOR_AVISO[a.color];
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      ((m.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(color);
      // El relleno crece hasta el borde justo cuando golpea.
      const k = 1 - Math.max(0, a.t) / a.total;
      m.position.set(a.x, 0.07, a.z);
      m.scale.setScalar(a.r * Math.max(0.05, k));
      (m.children[0] as THREE.Mesh).scale.setScalar(1 / Math.max(0.05, k));
    });
  }

  private dibujarProyectiles(p: Partida) {
    // Se recrean solo si cambia el tipo en esa posición.
    p.proyectiles.forEach((pr, i) => {
      if (this.tiposProyectil[i] !== pr.tipo) {
        const viejo = this.proyectiles[i];
        if (viejo) {
          this.escena.remove(viejo);
          liberar(viejo);
        }
        const m = pr.tipo === 'flecha'
          ? malla(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4).rotateX(Math.PI / 2), mat(MADERA))
          : malla(new THREE.CircleGeometry(0.7, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, wireframe: true, side: THREE.DoubleSide }), 0, 0, 0, false);
        this.proyectiles[i] = m;
        this.tiposProyectil[i] = pr.tipo;
        this.escena.add(m);
      }
      const m = this.proyectiles[i];
      m.visible = true;
      m.position.set(pr.x, pr.y, pr.z);
      m.rotation.y = pr.tipo === 'red' ? p.tiempo * 8 : Math.atan2(pr.vx, pr.vz);
      if (pr.tipo === 'flecha') (m as THREE.Mesh).material = mat(pr.delJugador ? 0xffd23f : MADERA, pr.delJugador);
    });
    for (let i = p.proyectiles.length; i < this.proyectiles.length; i++) this.proyectiles[i].visible = false;
  }

  private dibujarEfectos(p: Partida, completos: boolean) {
    const activos = new Set(p.efectos);
    for (const [ef, o] of this.efectos) {
      if (!activos.has(ef)) {
        this.escena.remove(o);
        liberar(o);
        this.efectos.delete(ef);
      }
    }
    for (const ef of p.efectos) {
      let o = this.efectos.get(ef);
      const k = 1 - ef.t / ef.total;
      if (!o) {
        o = this.crearEfecto(ef, completos);
        this.efectos.set(ef, o);
        this.escena.add(o);
      }
      if (ef.tipo === 'onda' || ef.tipo === 'gloria' || ef.tipo === 'polvo') {
        // Anillos que se abren.
        o.scale.setScalar(Math.max(0.1, (ef.tipo === 'gloria' ? 5 : ef.r) * (0.3 + k * 0.7)));
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      } else {
        // Partículas que salen hacia fuera y caen.
        o.children.forEach((c) => {
          const v = c.userData.v as THREE.Vector3 | undefined;
          if (!v) return;
          c.position.set(v.x * k, v.y * k - 4 * k * k, v.z * k);
          c.scale.setScalar(Math.max(0.05, 1 - k));
        });
        if (ef.tipo === 'parry' || ef.tipo === 'remate') o.scale.setScalar(1 + k * 1.5);
      }
    }
  }

  private crearEfecto(ef: Efecto, completos: boolean): THREE.Object3D {
    if (ef.tipo === 'onda' || ef.tipo === 'gloria' || ef.tipo === 'polvo') {
      const color = ef.tipo === 'gloria' ? 0xff7a2a : ef.tipo === 'polvo' ? 0xd8c09a : 0xffffff;
      return malla(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), ef.x, ef.y, ef.z, false);
    }
    const color = { chispa: 0xffe27a, sangre: 0xb71c1c, parry: 0x6fd8ff, remate: 0xff3030 }[ef.tipo];
    const g = new THREE.Group();
    g.position.set(ef.x, ef.y, ef.z);
    const n = completos ? (ef.tipo === 'remate' || ef.tipo === 'parry' ? 14 : 7) : 3;
    for (let i = 0; i < n; i++) {
      const c = malla(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(color, true), 0, 0, 0, false);
      c.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      g.add(c);
    }
    if (ef.tipo === 'parry') g.add(malla(new THREE.SphereGeometry(0.35, 10, 8), mat(0xbfefff, true, 0.6), 0, 0, 0, false));
    return g;
  }

  /** Proyecta un punto del mundo a la pantalla (barras, números y avisos). */
  proyectar(x: number, y: number, z: number, ancho: number, alto: number): { x: number; y: number; visible: boolean; detras: boolean } {
    const v = this.vp.set(x, y, z).project(this.camara);
    const detras = v.z > 1;
    return { x: ((v.x + 1) / 2) * ancho, y: ((1 - v.y) / 2) * alto, visible: !detras && Math.abs(v.x) < 1 && Math.abs(v.y) < 1, detras };
  }
}

export { Partida };
