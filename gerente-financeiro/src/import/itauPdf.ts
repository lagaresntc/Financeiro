import { normalizar } from '../domain/categorias';
import { parseLinha } from './generico';
import type { LancamentoImportado } from './tipos';

/** Pedaço de texto do PDF com posição (y cresce para cima, como no pdf.js). */
export interface ItemTexto {
  str: string;
  x: number;
  y: number;
  pagina: number;
}

const TOLERANCIA_Y = 2;

/** Agrupa itens em linhas: por página, coluna (esquerda antes da direita), y desc, x asc. */
export function montarLinhas(itens: ItemTexto[], meioX?: number): string[] {
  const paginas = [...new Set(itens.map((i) => i.pagina))].sort((a, b) => a - b);
  const linhas: string[] = [];
  for (const p of paginas) {
    const daPagina = itens.filter((i) => i.pagina === p && i.str.trim());
    if (daPagina.length === 0) continue;
    const meio = meioX ?? Math.max(...daPagina.map((i) => i.x)) / 2;
    for (const coluna of [daPagina.filter((i) => i.x < meio), daPagina.filter((i) => i.x >= meio)]) {
      const ordenados = [...coluna].sort((a, b) => b.y - a.y || a.x - b.x);
      let grupo: ItemTexto[] = [];
      const fechar = () => {
        if (grupo.length) linhas.push(grupo.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join(' '));
        grupo = [];
      };
      for (const it of ordenados) {
        if (grupo.length && Math.abs((grupo[0] as ItemTexto).y - it.y) > TOLERANCIA_Y) fechar();
        grupo.push(it);
      }
      fechar();
    }
  }
  return linhas;
}

type Secao = 'nenhuma' | 'nacional' | 'internacional' | 'ignorar';

function secaoDe(linha: string): Secao | undefined {
  const n = normalizar(linha);
  if (n.includes('COMPRAS PARCELADAS') && n.includes('PROXIMAS FATURAS')) return 'ignorar';
  if (n.includes('LANCAMENTOS INTERNACIONAIS')) return 'internacional';
  if (n.includes('LANCAMENTOS: COMPRAS E SAQUES') || n.includes('LANCAMENTOS: PRODUTOS E SERVICOS'))
    return 'nacional';
  return undefined;
}

/** Fatura do Itaú a partir dos itens de texto do pdf.js. */
export function parseItauItens(itens: ItemTexto[], meioX?: number): LancamentoImportado[] {
  const linhas = montarLinhas(itens, meioX);
  let anoVenc = new Date().getFullYear();
  let mesVenc: number | undefined;
  for (const l of linhas) {
    const m = /VENCIMENTO:?\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(normalizar(l));
    if (m) { mesVenc = Number(m[2]); anoVenc = Number(m[3]); break; }
  }
  const saida: LancamentoImportado[] = [];
  let secao: Secao = 'nenhuma';
  for (const l of linhas) {
    const nova = secaoDe(l);
    if (nova) { secao = nova; continue; }
    if (secao === 'nenhuma' || secao === 'ignorar') continue;
    const item = parseLinha(l, anoVenc, mesVenc);
    if (!item) continue; // ex.: linha de categoria/cidade
    if (secao === 'internacional') item.internacional = true;
    saida.push(item);
  }
  return saida;
}
