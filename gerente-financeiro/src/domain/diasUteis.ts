import type { Data } from './tipos';
import { diaDaSemana, montarData, somarDias, ultimoDia } from './datas';

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Data {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montarData(ano, mes, dia);
}

/**
 * Feriados nacionais e de MG em que o banco não paga.
 * MG: a data magna (21/04) já é feriado nacional.
 * Carnaval entra como dia não útil (bancos fecham).
 */
export function feriados(ano: number): Set<Data> {
  const fixos: [number, number][] = [
    [1, 1], // Confraternização
    [4, 21], // Tiradentes
    [5, 1], // Trabalho
    [9, 7], // Independência
    [10, 12], // Nossa Senhora Aparecida
    [11, 2], // Finados
    [11, 15], // Proclamação da República
    [11, 20], // Consciência Negra
    [12, 25], // Natal
  ];
  const p = pascoa(ano);
  return new Set<Data>([
    ...fixos.map(([m, d]) => montarData(ano, m, d)),
    somarDias(p, -48), // segunda de Carnaval
    somarDias(p, -47), // terça de Carnaval
    somarDias(p, -2), // Sexta-feira Santa
    somarDias(p, 60), // Corpus Christi
  ]);
}

export function ehDiaUtil(data: Data): boolean {
  const dow = diaDaSemana(data);
  if (dow === 0 || dow === 6) return false;
  return !feriados(Number(data.slice(0, 4))).has(data);
}

/** n-ésimo dia útil do mês (mes 1–12). */
export function enesimoDiaUtil(ano: number, mes: number, n: number): Data {
  let contados = 0;
  for (let dia = 1; dia <= ultimoDia(ano, mes); dia++) {
    const data = montarData(ano, mes, dia);
    if (ehDiaUtil(data) && ++contados === n) return data;
  }
  throw new Error(`O mês ${mes}/${ano} não tem ${n} dias úteis`);
}

export function quintoDiaUtil(ano: number, mes: number): Data {
  return enesimoDiaUtil(ano, mes, 5);
}
