import { parseLinhasGenericas } from './generico';
import { montarLinhas, parseItauItens } from './itauPdf';
import { parseNubankCsv } from './nubankCsv';
import type { LancamentoImportado } from './tipos';

export type Banco = 'itau' | 'nubank' | 'generico';

function ehCsv(arquivo: File): boolean {
  return /\.csv$/i.test(arquivo.name) || arquivo.type === 'text/csv';
}

/** Lê o arquivo da fatura e devolve os lançamentos para a tela de revisão. */
export async function lerFatura(banco: Banco, arquivo: File): Promise<LancamentoImportado[]> {
  if (banco === 'nubank' || ehCsv(arquivo)) return parseNubankCsv(await arquivo.text());
  // pdf.js é pesado: só carrega quando alguém importa um PDF.
  const { extrairItensPdf } = await import('./pdfTexto');
  const itens = await extrairItensPdf(await arquivo.arrayBuffer());
  if (banco === 'itau') return parseItauItens(itens);
  return parseLinhasGenericas(montarLinhas(itens), new Date().getFullYear());
}
