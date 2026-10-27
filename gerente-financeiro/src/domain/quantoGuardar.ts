import type { Centavos, Mes, ParametrosPlano, SituacaoAtual } from './tipos';
import { mesesEntre } from './datas';
import { projetar, type Projecao } from './projecao';

export type ResultadoQuantoGuardar =
  | { possivel: true; metaMensalCentavos: Centavos; mesPronto: Mes; projecao: Projecao }
  | {
      possivel: false;
      /** Melhor data possível guardando todo o possível em cada mês. */
      melhorMes: Mes | null;
      /** Meses em que a meta foi cortada pela margem (onde o plano trava). */
      mesesTravados: Mes[];
      /** Quanto ainda faltaria na meta na data-alvo, guardando o máximo. */
      faltaNaDataCentavos: Centavos;
    };

const MAX_META: Centavos = 100_000_00; // R$ 100 mil/mês: teto da busca

/**
 * Menor meta mensal padrão (centavos) para que `metaId` fique pronta até `dataAlvo`.
 * Busca binária: só muda `metaMensalCentavos`; as exceções por mês ficam como estão.
 */
export function quantoGuardar(
  situacao: SituacaoAtual,
  parametros: ParametrosPlano,
  metaId: string,
  dataAlvo: Mes,
): ResultadoQuantoGuardar {
  const horizonteMeses = Math.max(1, mesesEntre(situacao.mesInicial, dataAlvo) + 1);
  const rodar = (meta: Centavos) =>
    projetar(situacao, { ...parametros, metaMensalCentavos: meta }, { horizonteMeses });
  const ok = (proj: Projecao) => {
    const d = proj.datas[metaId];
    return d !== undefined && d <= dataAlvo;
  };

  const noMaximo = rodar(MAX_META);
  if (!ok(noMaximo)) {
    const destino = parametros.destinos.find(d => d.metaId === metaId);
    const ultimo = noMaximo.meses[noMaximo.meses.length - 1];
    const saldo = ultimo?.saldos[metaId] ?? 0;
    const longo = projetar(situacao, { ...parametros, metaMensalCentavos: MAX_META }, { horizonteMeses: 240 });
    return {
      possivel: false,
      melhorMes: longo.datas[metaId] ?? null,
      mesesTravados: noMaximo.meses.filter(m => m.metaCentavos < m.metaPlanejadaCentavos).map(m => m.mes),
      faltaNaDataCentavos: Math.max(0, (destino?.alvoCentavos ?? saldo) - saldo),
    };
  }

  // Busca em reais inteiros (100 centavos) — precisão suficiente para planejar.
  let lo = 0;
  let hi = MAX_META / 100;
  while (lo < hi) {
    const meio = Math.floor((lo + hi) / 2);
    if (ok(rodar(meio * 100))) hi = meio;
    else lo = meio + 1;
  }
  const proj = rodar(lo * 100);
  return { possivel: true, metaMensalCentavos: lo * 100, mesPronto: proj.datas[metaId]!, projecao: proj };
}
