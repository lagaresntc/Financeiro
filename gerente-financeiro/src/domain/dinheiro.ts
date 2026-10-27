import type { Centavos } from './tipos';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 → 'R$ 1.234,56' (espaço normal, não o NBSP do Intl) */
export function formatarReais(centavos: Centavos): string {
  return fmt.format(centavos / 100).replace(/ /g, ' ');
}

/** Converte reais (ex.: 749.84) para centavos inteiros, arredondando. */
export function reaisParaCentavos(reais: number): Centavos {
  return Math.round(reais * 100);
}

export function somar(valores: Centavos[]): Centavos {
  return valores.reduce((s, v) => s + v, 0);
}

/** pct de 0 a 100, resultado arredondado para centavos */
export function porcentagem(valor: Centavos, pct: number): Centavos {
  return Math.round((valor * pct) / 100);
}
