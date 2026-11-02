import type { Navegar } from '../core/input';

/**
 * Recorre los menús con el mando: la cruceta (o el stick) mueve el foco entre los botones del panel,
 * A pulsa, B vuelve (el botón de la cabecera) y, en un deslizador, izquierda y derecha cambian el valor.
 */
export function navegarMenu(eventos: Navegar[]) {
  if (!eventos.length) return;
  const ui = document.getElementById('ui');
  if (!ui) return;
  const enfocables = [...ui.querySelectorAll<HTMLElement>('button:not(:disabled), input, .cz-colores button')].filter((el) => el.offsetParent !== null);
  if (!enfocables.length) return;
  const actual = document.activeElement as HTMLElement | null;
  let i = actual ? enfocables.indexOf(actual) : -1;
  for (const e of eventos) {
    const el = enfocables[i];
    const rango = el instanceof HTMLInputElement && el.type === 'range';
    if ((e === 'izquierda' || e === 'derecha') && rango) {
      const paso = Number(el.step) || 1;
      el.value = String(Number(el.value) + (e === 'derecha' ? paso : -paso));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      continue;
    }
    if (e === 'abajo' || e === 'derecha') i = i < 0 ? 0 : (i + 1) % enfocables.length;
    else if (e === 'arriba' || e === 'izquierda') i = i < 0 ? 0 : (i - 1 + enfocables.length) % enfocables.length;
    else if (e === 'aceptar') {
      if (el) el.click();
      else enfocables[0].focus();
      return;
    } else if (e === 'atras') {
      ui.querySelector<HTMLButtonElement>('.cabecera .btn')?.click();
      return;
    }
  }
  const destino = enfocables[Math.max(0, i)];
  destino.focus();
  destino.classList.add('foco-mando');
  destino.scrollIntoView({ block: 'nearest' });
  destino.addEventListener('blur', () => destino.classList.remove('foco-mando'), { once: true });
}
