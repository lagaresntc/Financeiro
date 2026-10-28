import type { Centavos, ConsignadoCfg, EstadoConsignado, Mes } from './tipos';
import { mesesEntre, somarMeses } from './datas';

export function quitado(estado: EstadoConsignado): boolean {
  return estado.menorAberta > estado.maiorAberta;
}

export function parcelasAbertas(estado: EstadoConsignado): number {
  return quitado(estado) ? 0 : estado.maiorAberta - estado.menorAberta + 1;
}

/** Valor nominal ainda devido da parcela t. */
function nominalDa(cfg: ConsignadoCfg, estado: EstadoConsignado, t: number): Centavos {
  return t === estado.maiorAberta ? estado.nominalMaiorCentavos : cfg.parcelaCentavos;
}

/**
 * Custo para antecipar a parcela t no mês `mes`:
 *   custo(t, m) = k × base^m / base^t, m = meses desde o mês-base.
 * Parcela parcial: custo proporcional ao nominal que resta.
 */
export function custoParcela(
  cfg: ConsignadoCfg,
  t: number,
  mes: Mes,
  nominalCentavos: Centavos = cfg.parcelaCentavos,
): Centavos {
  const m = mesesEntre(cfg.mesBase, mes);
  const cheia = cfg.k * 100 * Math.pow(cfg.base, m - t);
  return Math.round((cheia * nominalCentavos) / cfg.parcelaCentavos);
}

/** Quanto custa quitar tudo no mês (soma do custo de cada parcela aberta). */
export function saldoParaQuitar(cfg: ConsignadoCfg, estado: EstadoConsignado, mes: Mes): Centavos {
  let total = 0;
  for (let t = estado.menorAberta; t <= estado.maiorAberta; t++) {
    total += custoParcela(cfg, t, mes, nominalDa(cfg, estado, t));
  }
  return total;
}

/** Soma nominal das parcelas abertas (o que a folha descontaria sem antecipar). */
export function saldoNominal(cfg: ConsignadoCfg, estado: EstadoConsignado): Centavos {
  const n = parcelasAbertas(estado);
  if (n === 0) return 0;
  return (n - 1) * cfg.parcelaCentavos + estado.nominalMaiorCentavos;
}

export interface ResultadoAntecipacao {
  estado: EstadoConsignado;
  pagoCentavos: Centavos;
  /** Parcelas quitadas por inteiro, da maior para a menor. Null se nenhuma inteira. */
  quitadas: { de: number; ate: number } | null;
  /** Nominal abatido da próxima parcela com o resto do dinheiro. */
  abatidoParcialCentavos: Centavos;
}

/**
 * Antecipa com `valor` no mês: quita da maior parcela aberta para baixo enquanto couber;
 * o resto abate parte da próxima (proporcional ao custo). Nunca paga mais que o saldo.
 */
export function antecipar(
  cfg: ConsignadoCfg,
  estado: EstadoConsignado,
  mes: Mes,
  valor: Centavos,
): ResultadoAntecipacao {
  let { menorAberta, maiorAberta, nominalMaiorCentavos } = estado;
  let resta = valor;
  let pago = 0;
  const primeira = maiorAberta;
  let abatido = 0;

  while (menorAberta <= maiorAberta && resta > 0) {
    const custo = custoParcela(cfg, maiorAberta, mes, nominalMaiorCentavos);
    if (resta >= custo) {
      resta -= custo;
      pago += custo;
      maiorAberta--;
      nominalMaiorCentavos = cfg.parcelaCentavos;
    } else {
      abatido = Math.min(nominalMaiorCentavos - 1, Math.floor((nominalMaiorCentavos * resta) / custo));
      nominalMaiorCentavos -= abatido;
      pago += resta;
      resta = 0;
    }
  }

  const novoEstado = { menorAberta, maiorAberta, nominalMaiorCentavos };
  return {
    estado: novoEstado,
    pagoCentavos: pago,
    quitadas: maiorAberta < primeira ? { de: primeira, ate: maiorAberta + 1 } : null,
    abatidoParcialCentavos: abatido,
  };
}

/**
 * Desconto da folha (dia 5): paga a menor parcela aberta.
 * Devolve o nominal descontado (0 se já quitado).
 */
export function pagarFolha(
  cfg: ConsignadoCfg,
  estado: EstadoConsignado,
): { estado: EstadoConsignado; descontadoCentavos: Centavos } {
  if (quitado(estado)) return { estado, descontadoCentavos: 0 };
  const descontado = nominalDa(cfg, estado, estado.menorAberta);
  return {
    estado: { ...estado, menorAberta: estado.menorAberta + 1 },
    descontadoCentavos: descontado,
  };
}

export interface MesConsignado {
  mes: Mes;
  saldoCentavos: Centavos;
  parcelasAbertas: number;
}

export interface ProjecaoConsignado {
  meses: MesConsignado[];
  mesQuitacao: Mes | null;
  totalPagoCentavos: Centavos;
  /** Total pago daqui em diante menos o saldo para quitar hoje. */
  jurosCentavos: Centavos;
}

/**
 * Só o consignado, mês a mês: a folha paga a menor parcela (a partir do mês seguinte) e, se houver,
 * amortizações extras antecipam as últimas. O estado de entrada já considera a folha do mês inicial.
 */
export function projetarConsignado(
  cfg: ConsignadoCfg,
  estado: EstadoConsignado,
  mesInicial: Mes,
  opcoes: { extraMensalCentavos?: Centavos; extraAgoraCentavos?: Centavos; horizonteMeses?: number } = {},
): ProjecaoConsignado {
  const { extraMensalCentavos = 0, extraAgoraCentavos = 0, horizonteMeses = 240 } = opcoes;
  let e = estado;
  let total = 0;
  let mesQuitacao: Mes | null = quitado(e) ? mesInicial : null;
  const meses: MesConsignado[] = [];
  for (let i = 0; i < horizonteMeses && !mesQuitacao; i++) {
    const mes = somarMeses(mesInicial, i);
    if (i > 0) {
      const f = pagarFolha(cfg, e);
      e = f.estado;
      total += f.descontadoCentavos;
    }
    const extra = (i === 0 ? extraAgoraCentavos : 0) + extraMensalCentavos;
    if (extra > 0 && !quitado(e)) {
      const r = antecipar(cfg, e, mes, extra);
      e = r.estado;
      total += r.pagoCentavos;
    }
    const fim = quitado(e);
    meses.push({ mes, saldoCentavos: fim ? 0 : saldoParaQuitar(cfg, e, mes), parcelasAbertas: parcelasAbertas(e) });
    if (fim) mesQuitacao = mes;
  }
  return { meses, mesQuitacao, totalPagoCentavos: total, jurosCentavos: total - saldoParaQuitar(cfg, estado, mesInicial) };
}

