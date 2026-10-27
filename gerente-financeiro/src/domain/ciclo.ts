import type { Centavos, Data, Mes } from './tipos';
import { diasEntre, mesDe, partesMes, montarMes, somarMeses } from './datas';
import { quintoDiaUtil } from './diasUteis';
import type { Projecao } from './projecao';

export interface Ciclo {
  /** Dia do salário que abriu o ciclo. */
  inicio: Data;
  /** Dia do próximo salário (o ciclo termina na véspera). */
  fim: Data;
  /** Mês do salário que abriu o ciclo. */
  mes: Mes;
}

function salarioDoMes(mes: Mes): Data {
  const [a, m] = partesMes(mes);
  return quintoDiaUtil(a, m);
}

/** O ciclo vai do salário (5º dia útil) até o próximo salário. */
export function cicloDoDia(hoje: Data): Ciclo {
  const mesHoje = mesDe(hoje);
  const salarioEsteMes = salarioDoMes(mesHoje);
  const mes = hoje >= salarioEsteMes ? mesHoje : somarMeses(mesHoje, -1);
  const [a, m] = partesMes(mes);
  return { inicio: salarioDoMes(mes), fim: salarioDoMes(montarMes(a, m + 1)), mes };
}

export interface PodeGastar {
  /** Quanto ainda dá para gastar até o próximo salário sem atrasar o plano. */
  valorCentavos: Centavos;
  /** O total que o ciclo comporta (antes dos gastos já lançados). */
  envelopeCentavos: Centavos;
  gastosCentavos: Centavos;
  diasRestantes: number;
  porDiaCentavos: Centavos;
  /** 0 a 1: quanto do ciclo já passou. */
  progressoCiclo: number;
}

/**
 * podeGastar = renda − fixas − faturas − meta − margem mínima − gastos já lançados no ciclo.
 *
 * O que se gasta no ciclo do mês M (no cartão) só é pago nas faturas de M+1. Por isso o envelope
 * do ciclo vem da linha M+1 da projeção: o orçamento variável dela mais o que sobra acima da margem.
 */
export function calcularPodeGastar(
  projecao: Projecao,
  ciclo: Ciclo,
  hoje: Data,
  gastosNoCicloCentavos: Centavos,
  margemMinimaCentavos: Centavos,
): PodeGastar {
  const linha =
    projecao.meses.find(m => m.mes === somarMeses(ciclo.mes, 1)) ??
    projecao.meses.find(m => m.mes === ciclo.mes) ??
    projecao.meses[0];
  const envelope = linha ? Math.max(0, linha.variavelCentavos + linha.folgaCentavos - margemMinimaCentavos) : 0;
  const valor = envelope - gastosNoCicloCentavos;
  const total = Math.max(1, diasEntre(ciclo.inicio, ciclo.fim));
  const diasRestantes = Math.max(1, diasEntre(hoje, ciclo.fim));
  return {
    valorCentavos: valor,
    envelopeCentavos: envelope,
    gastosCentavos: gastosNoCicloCentavos,
    diasRestantes,
    porDiaCentavos: valor > 0 ? Math.floor(valor / diasRestantes) : 0,
    progressoCiclo: Math.min(1, Math.max(0, diasEntre(ciclo.inicio, hoje) / total)),
  };
}
