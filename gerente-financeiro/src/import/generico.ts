import { montarData } from '../domain/datas';
import type { LancamentoImportado } from './tipos';
import { parseValorBR } from './valores';

// DD/MM  texto  [NN/NN]  valor no fim
const LINHA = /^(\d{2})\/(\d{2})\s+(.+?)\s+(?:(\d{2})\/(\d{2})\s+)?(-\s?)?(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})$/;

/** Ano da compra: mês depois do vencimento = ano anterior. */
export function anoDaCompra(mes: number, anoVenc: number, mesVenc?: number): number {
  return mesVenc !== undefined && mes > mesVenc ? anoVenc - 1 : anoVenc;
}

/** Lê uma linha "DD/MM ESTAB[ NN/NN] 1.234,56"; undefined se não for lançamento. */
export function parseLinha(
  linha: string,
  anoPadrao: number,
  mesVencimento?: number,
): LancamentoImportado | undefined {
  const m = LINHA.exec(linha.replace(/\s+/g, ' ').trim());
  if (!m) return undefined;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return undefined;
  const valor = parseValorBR(m[7] ?? '');
  if (Number.isNaN(valor)) return undefined;
  const item: LancamentoImportado = {
    data: montarData(anoDaCompra(mes, anoPadrao, mesVencimento), mes, dia),
    descricao: (m[3] ?? '').trim(),
    valorCentavos: m[6] ? -valor : valor,
  };
  if (m[4] && m[5]) {
    const k = Number(m[4]);
    const n = Number(m[5]);
    if (k >= 1 && n >= 2 && k <= n) item.parcela = { k, n };
    else item.descricao += ` ${m[4]}/${m[5]}`;
  }
  return item;
}

/** Parser genérico (BB e outros): linhas com data DD/MM, texto e valor no fim. */
export function parseLinhasGenericas(
  linhas: string[],
  anoPadrao: number,
  mesVencimento?: number,
): LancamentoImportado[] {
  const saida: LancamentoImportado[] = [];
  for (const l of linhas) {
    const item = parseLinha(l, anoPadrao, mesVencimento);
    if (item) saida.push(item);
  }
  return saida;
}
