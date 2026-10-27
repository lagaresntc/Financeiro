import type { CartaoCfg, Data, Mes } from './tipos';
import { montarData, partesMes, somarMeses, ultimoDia, montarMes } from './datas';

/** Dia de vencimento válido para uma competência (considera as mudanças de vencimento). */
export function diaVencimentoEm(cartao: CartaoCfg, competencia: Mes): number {
  let dia = cartao.diaVencimento;
  for (const v of [...(cartao.vencimentos ?? [])].sort((a, b) => a.aPartirDe.localeCompare(b.aPartirDe))) {
    if (v.aPartirDe <= competencia) dia = v.dia;
  }
  return dia;
}

/** Fatura que vence no mês seguinte ao fechamento (ex.: BB fecha 30, vence 12). */
function venceNoMesSeguinte(cartao: CartaoCfg): boolean {
  return cartao.diaVencimento <= cartao.diaFechamento;
}

/** Dia de fechamento efetivo no mês (fecha 30 em fevereiro → fecha no último dia). */
function diaFechamentoNoMes(cartao: CartaoCfg, ano: number, mes: number): number {
  return Math.min(cartao.diaFechamento, ultimoDia(ano, mes));
}

/**
 * Competência (mês de vencimento) da fatura em que cai uma compra.
 * Até o dia do fechamento (inclusive) → fatura que fecha neste mês; depois → a próxima.
 */
export function competenciaDaCompra(cartao: CartaoCfg, data: Data): Mes {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  const fechaEsteMes = dia <= diaFechamentoNoMes(cartao, ano, mes);
  const mesFechamento = montarMes(ano, fechaEsteMes ? mes : mes + 1);
  return venceNoMesSeguinte(cartao) ? somarMeses(mesFechamento, 1) : mesFechamento;
}

/** Competência em que cai a parcela k (1-based) de uma compra. */
export function competenciaDaParcela(cartao: CartaoCfg, dataCompra: Data, k: number): Mes {
  return somarMeses(competenciaDaCompra(cartao, dataCompra), k - 1);
}

/** Datas de fechamento e vencimento da fatura de uma competência. */
export function datasDaFatura(cartao: CartaoCfg, competencia: Mes): { fechamento: Data; vencimento: Data } {
  const [anoV, mesV] = partesMes(competencia);
  const diaV = Math.min(diaVencimentoEm(cartao, competencia), ultimoDia(anoV, mesV));
  const mesF = venceNoMesSeguinte(cartao) ? somarMeses(competencia, -1) : competencia;
  const [anoF, mF] = partesMes(mesF);
  return {
    fechamento: montarData(anoF, mF, diaFechamentoNoMes(cartao, anoF, mF)),
    vencimento: montarData(anoV, mesV, diaV),
  };
}

/**
 * Melhor dia de compra a partir de uma data: o dia seguinte ao próximo fechamento
 * (ou a própria data, se já for logo após um fechamento).
 */
export function melhorDiaDeCompra(cartao: CartaoCfg, aPartirDe: Data): Data {
  const [ano, mes, dia] = aPartirDe.split('-').map(Number) as [number, number, number];
  const fech = diaFechamentoNoMes(cartao, ano, mes);
  if (dia > fech) {
    // já passou o fechamento deste mês: hoje já é "depois do fechamento"
    return aPartirDe;
  }
  const proximo = fech + 1;
  if (proximo <= ultimoDia(ano, mes)) return montarData(ano, mes, proximo);
  const [a2, m2] = partesMes(montarMes(ano, mes + 1));
  return montarData(a2, m2, 1);
}
