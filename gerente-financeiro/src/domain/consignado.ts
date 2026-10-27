import type { Centavos, ConsignadoCfg, EstadoConsignado, Mes } from './tipos';
import { mesesEntre } from './datas';

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
