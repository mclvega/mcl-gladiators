import { app } from '../app';
import { audio } from '../audio';
import { ARMAS, multNivelArma } from '../core/armas';
import { generarCombate, REGLAS } from '../core/combates';
import { generarTienda, NOMBRE_RANURA, precioArma, precioPieza, precioReparar, precioVenta, RANURAS, type Oferta, type Pieza } from '../core/equipo';
import { ATRIBUTOS, calcularStats, costeAtributo, rangoDe } from '../core/progreso';
import { temaDe } from '../core/arena';
import { boton, h, mostrarPanel } from './dom';

type Pestana = 'combate' | 'tienda' | 'entrenador' | 'armeria';

const pct = (x: number) => `${Math.round(x * 100)} %`;

function textoPieza(p: Pieza): string {
  return `🛡 ${pct(p.defensa)} · ⚖️ ${p.peso} kg · 🔧 ${Math.ceil(p.durabilidad)}/${p.durMax}`;
}

/** Barra de durabilidad (verde, amarilla o roja). */
function durabilidad(p: Pieza | null): HTMLElement {
  const k = p ? p.durabilidad / p.durMax : 0;
  const color = !p || k <= 0 ? '#ff5a5a' : k < 0.35 ? '#ffb020' : '#5ad13c';
  return h('div', { class: 'dur' }, h('div', { class: 'dur-relleno', style: `width:${Math.round(k * 100)}%;background:${color}` }));
}

/**
 * El ludus: la escuela de gladiadores entre combates. Se elige el siguiente combate,
 * se compra equipo en la tienda, se entrena con el maestro y se repara en la armería.
 */
export function pantallaLudus(opciones: { alLuchar: () => void; alVolver: () => void }, pestana: Pestana = 'combate') {
  const g = app.g;
  const ir = (p: Pestana) => pantallaLudus(opciones, p);
  const stats = calcularStats(g.atributos, g.equipo, g.arma);
  const rango = rangoDe(g.fama);
  const pestanas = (['combate', 'tienda', 'entrenador', 'armeria'] as Pestana[]).map((p) => {
    const b = boton({ combate: '⚔️ Combate', tienda: '🛒 Tienda', entrenador: '🏋️ Entrenar', armeria: '🔨 Armería' }[p], () => ir(p));
    b.setAttribute('aria-pressed', String(p === pestana));
    return b;
  });

  let cuerpo: HTMLElement[];
  if (pestana === 'combate') {
    const c = generarCombate(g.combate);
    const regla = REGLAS[c.regla];
    const rivales = c.oleadas.flat().length;
    const rotas = RANURAS.filter((r) => g.equipo[r] && g.equipo[r]!.durabilidad <= 0);
    const lista: Array<HTMLElement | null> = [
      h('div', { class: 'tarjeta-combate' },
        h('strong', { text: `${regla.icono} Combate ${g.combate}: ${regla.nombre}` }),
        h('span', { text: c.campeon ? `Te reta ${c.campeon}.` : regla.texto }),
        h('small', { class: 'texto-suave', text: `${temaDe(g.combate).nombre} · ${rivales} ${rivales === 1 ? 'rival' : 'rivales'}${c.oleadas.length > 1 ? ` en ${c.oleadas.length} oleadas` : ''}` }),
      ),
      rotas.length ? h('p', { class: 'aviso', text: `💔 Tienes piezas rotas (${rotas.map((r) => NOMBRE_RANURA[r].nombre.toLowerCase()).join(', ')}). Repáralas en la armería.` }) : null,
      boton('¡A la arena!', opciones.alLuchar, { variante: 'primario', icono: '⚔️' }),
      h('div', { class: 'ficha' },
        h('span', { text: `❤️ ${stats.vidaMax} vida` }),
        h('span', { text: `💨 ${stats.estaminaMax} estamina` }),
        h('span', { text: `🗡️ ×${stats.dano.toFixed(2)} daño` }),
        h('span', { text: `🎯 ${pct(stats.critico)} crítico` }),
        h('span', { class: stats.carga > 0.6 ? 'pesado' : '', text: `⚖️ ${stats.peso.toFixed(1)} kg${stats.carga > 0.6 ? ' (pesado: más lento)' : ''}` }),
        h('span', { text: `${ARMAS[g.arma.id].icono} ${ARMAS[g.arma.id].nombre} nv. ${g.arma.nivel}` }),
      ),
    ];
    cuerpo = lista.filter((x): x is HTMLElement => !!x);
  } else if (pestana === 'tienda') {
    if (g.tienda.combate !== g.combate) g.tienda = { combate: g.combate, compradas: [] };
    const ofertas = generarTienda(g.combate);
    cuerpo = [
      h('p', { class: 'texto-suave', text: 'Género nuevo tras cada victoria. Lo que compras sustituye a lo que llevas, y te dan algo por lo viejo.' }),
      ...ofertas.map((o, i) => filaOferta(o, i, () => ir('tienda'))),
    ];
  } else if (pestana === 'entrenador') {
    cuerpo = [
      h('p', { class: 'texto-suave', text: 'El maestro te entrena a cambio de oro. No hay tope: cada punto cuesta algo más.' }),
      ...ATRIBUTOS.map((a) => {
        const n = g.atributos[a.id];
        const coste = costeAtributo(n);
        const b = boton(`💰 ${coste}`, () => {
          if (g.oro < coste) return;
          g.oro -= coste;
          g.atributos[a.id]++;
          app.guardar();
          audio.efecto('nivel');
          ir('entrenador');
        }, { variante: g.oro >= coste ? 'primario' : 'suave' });
        b.disabled = g.oro < coste;
        return h('div', { class: 'mejora' }, h('div', { class: 'mejora-texto' }, h('strong', { text: `${a.icono} ${a.nombre} (${n})` }), h('small', { text: a.texto })), b);
      }),
    ];
  } else {
    const total = RANURAS.reduce((s, r) => s + (g.equipo[r] ? precioReparar(g.equipo[r]!) : 0), 0);
    const todo = boton(total ? `Reparar todo · 💰 ${total}` : 'Todo está como nuevo', () => {
      if (g.oro < total) return;
      g.oro -= total;
      for (const r of RANURAS) {
        const p = g.equipo[r];
        if (p) p.durabilidad = p.durMax;
      }
      app.guardar();
      audio.efecto('recoger');
      ir('armeria');
    }, { variante: 'primario', icono: '🔨' });
    todo.disabled = !total || g.oro < total;
    cuerpo = [
      todo,
      ...RANURAS.map((r) => {
        const p = g.equipo[r];
        const precio = p ? precioReparar(p) : 0;
        const b = boton(p ? (precio ? `💰 ${precio}` : 'Bien') : '—', () => {
          if (!p || g.oro < precio) return;
          g.oro -= precio;
          p.durabilidad = p.durMax;
          app.guardar();
          audio.efecto('recoger');
          ir('armeria');
        }, { variante: 'suave' });
        b.disabled = !p || !precio || g.oro < precio;
        return h('div', { class: 'mejora' },
          h('div', { class: 'mejora-texto' },
            h('strong', { text: `${NOMBRE_RANURA[r].icono} ${p ? p.nombre : `Sin ${NOMBRE_RANURA[r].nombre.toLowerCase()}`}` }),
            p ? h('small', { text: textoPieza(p) }) : h('small', { text: 'Esta zona recibe el daño completo. Compra una pieza en la tienda.' }),
            durabilidad(p),
          ),
          b,
        );
      }),
    ];
  }

  mostrarPanel(
    h('div', { class: 'tarjeta ancha' },
      h('div', { class: 'cabecera' }, boton('Menú', opciones.alVolver, { icono: '←' }), h('h2', { text: '🏛️ El ludus' })),
      h('p', { class: 'texto-suave', text: `💰 ${g.oro} · ⭐ ${g.fama} de fama · ${rango.nombre} (siguiente rango: ${rango.siguiente})` }),
      h('div', { class: 'segmentado' }, ...pestanas),
      ...cuerpo,
    ),
  );
}

function filaOferta(o: Oferta, i: number, repintar: () => void): HTMLElement {
  const g = app.g;
  const comprada = g.tienda.compradas.includes(i);
  let titulo: string;
  let detalle: string;
  let actual: string;
  let venta: number;
  if (o.tipo === 'pieza') {
    const p = o.pieza;
    const puesta = g.equipo[p.ranura];
    titulo = `${NOMBRE_RANURA[p.ranura].icono} ${p.nombre}`;
    detalle = textoPieza(p);
    actual = puesta ? `Llevas: ${pct(puesta.defensa)} · ${puesta.peso} kg` : 'No llevas nada en esa zona.';
    venta = puesta ? precioVenta(precioPieza(puesta)) : 0;
  } else {
    const a = ARMAS[o.arma.id];
    titulo = `${a.icono} ${a.nombre} nv. ${o.arma.nivel}`;
    detalle = `${a.texto} Daño ×${multNivelArma(o.arma.nivel).toFixed(2)} · ⚖️ ${a.peso} kg`;
    actual = `Llevas: ${ARMAS[g.arma.id].nombre} nv. ${g.arma.nivel} (×${multNivelArma(g.arma.nivel).toFixed(2)})`;
    venta = precioVenta(precioArma(g.arma));
  }
  const coste = Math.max(0, o.precio - venta);
  const b = boton(comprada ? 'Comprado' : `💰 ${coste}`, () => {
    if (comprada || g.oro < coste) return;
    g.oro -= coste;
    if (o.tipo === 'pieza') g.equipo[o.pieza.ranura] = { ...o.pieza };
    else g.arma = { ...o.arma };
    g.tienda.compradas.push(i);
    app.guardar();
    audio.efecto('recoger');
    repintar();
  }, { variante: !comprada && g.oro >= coste ? 'primario' : 'suave' });
  b.disabled = comprada || g.oro < coste;
  return h('div', { class: 'mejora' },
    h('div', { class: 'mejora-texto' }, h('strong', { text: titulo }), h('small', { text: detalle }), h('small', { class: 'texto-suave', text: `${actual}${venta ? ` · Te dan 💰 ${venta} por lo tuyo.` : ''}` })),
    b,
  );
}
