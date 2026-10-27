import type { Centavos } from '../domain/tipos';

/** '1.234,56' → 123456; aceita '- 12,34', 'R$ 1.234,56' e '1234.56' (CSV). NaN se inválido. */
export function parseValorBR(texto: string): Centavos {
  let s = texto.replace(/R\$/gi, '').replace(/\s+/g, '');
  const negativo = s.startsWith('-');
  s = s.replace(/^[-+]/, '');
  let inteiro: string;
  let frac = '';
  if (s.includes(',')) {
    [inteiro = '', frac = ''] = s.replace(/\./g, '').split(',');
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [inteiro = '', frac = ''] = s.split('.');
  } else {
    inteiro = s.replace(/\./g, '');
  }
  if (!/^\d+$/.test(inteiro) || !/^\d{0,2}$/.test(frac)) return NaN;
  // monta em inteiros, sem float
  const cent = Number(inteiro) * 100 + Number(frac.padEnd(2, '0') || '0');
  return negativo ? -cent : cent;
}

/** "02/10", "PARCELA 2/3" → {k, n}; undefined se não houver. */
export function parseParcela(texto: string): { k: number; n: number } | undefined {
  const m = /(?:^|[^\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/.exec(texto);
  if (!m) return undefined;
  const k = Number(m[1]);
  const n = Number(m[2]);
  if (k < 1 || n < 2 || k > n) return undefined;
  return { k, n };
}
