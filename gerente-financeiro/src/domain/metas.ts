import type { Centavos } from './tipos';

/** 0 a 1 (pode passar de 1 se o saldo passar do alvo). */
export function fracaoConcluida(saldo: Centavos, alvo: Centavos | undefined): number {
  if (!alvo || alvo <= 0) return 0;
  return Math.max(0, saldo / alvo);
}

/**
 * Quanto guardar por mês, em `meses` depósitos, para o saldo chegar ao alvo rendendo `taxaMensal`.
 * Valor futuro de uma série: alvo = saldo·(1+r)^n + p·((1+r)^n − 1)/r. Arredonda para cima.
 */
export function aporteMensalParaMeta(alvo: Centavos, saldo: Centavos, meses: number, taxaMensal = 0): Centavos {
  if (meses <= 0) return Math.max(0, alvo - saldo);
  const fator = Math.pow(1 + taxaMensal, meses);
  const falta = alvo - saldo * fator;
  if (falta <= 0) return 0;
  if (taxaMensal === 0) return Math.ceil(falta / meses);
  return Math.ceil((falta * taxaMensal) / (fator - 1));
}

/** Rendimento mensal equivalente a pct do CDI anual (ex.: 1,2 = 120% do CDI). */
export function taxaMensalDoCdi(cdiAnual: number, pctCdi: number): number {
  return Math.pow(1 + cdiAnual * pctCdi, 1 / 12) - 1;
}
