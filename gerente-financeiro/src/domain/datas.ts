import type { Data, Mes } from './tipos';

export function mesDe(data: Data): Mes {
  return data.slice(0, 7);
}

export function partesMes(mes: Mes): [number, number] {
  return [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))];
}

export function montarMes(ano: number, mes: number): Mes {
  // mes 1–12, aceita estouro (13 = jan do ano seguinte, 0 = dez do anterior)
  const total = ano * 12 + (mes - 1);
  const a = Math.floor(total / 12);
  const m = total - a * 12 + 1;
  return `${a}-${String(m).padStart(2, '0')}`;
}

export function somarMeses(mes: Mes, n: number): Mes {
  const [a, m] = partesMes(mes);
  return montarMes(a, m + n);
}

/** Quantos meses de `de` até `ate` (pode ser negativo). */
export function mesesEntre(de: Mes, ate: Mes): number {
  const [a1, m1] = partesMes(de);
  const [a2, m2] = partesMes(ate);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function montarData(ano: number, mes: number, dia: number): Data {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(data: Data): number {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function somarDias(data: Data, n: number): Data {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return montarData(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const NOMES_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2027-05' → 'mai/2027' */
export function formatarMes(mes: Mes): string {
  const [a, m] = partesMes(mes);
  return `${NOMES_MESES[m - 1]}/${a}`;
}

/** '2026-12-12' → '12/12/2026' */
export function formatarData(data: Data): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
