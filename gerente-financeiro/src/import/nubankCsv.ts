import type { LancamentoImportado } from './tipos';
import { parseParcela, parseValorBR } from './valores';

/** Divide uma linha CSV respeitando aspas ("" = aspas literal). */
export function dividirCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { campos.push(atual); atual = ''; }
    else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** CSV do Nubank: date,title,amount. Negativos (pagamentos/créditos) são ignorados. */
export function parseNubankCsv(texto: string): LancamentoImportado[] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const saida: LancamentoImportado[] = [];
  for (const linha of linhas) {
    const [data = '', titulo = '', valor = ''] = dividirCsv(linha);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue; // cabeçalho ou lixo
    const valorCentavos = parseValorBR(valor);
    if (Number.isNaN(valorCentavos) || valorCentavos <= 0) continue;
    const item: LancamentoImportado = { data, descricao: titulo, valorCentavos };
    const parcela = /parcela/i.test(titulo) ? parseParcela(titulo) : undefined;
    if (parcela) item.parcela = parcela;
    saida.push(item);
  }
  return saida;
}
