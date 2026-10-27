import type { Centavos, CartaoCfg, Data, Mes, ParametrosPlano, SituacaoAtual } from './tipos';
import { mesesEntre } from './datas';
import { competenciaDaCompra, datasDaFatura, melhorDiaDeCompra } from './faturas';
import { projetar, type Projecao } from './projecao';

export interface CompraSimulada {
  valorCentavos: Centavos;
  parcelas: number;
  /** id do cartão; 'pix' ou 'dinheiro' = à vista no mês da compra */
  forma: string;
  data: Data;
  descricao?: string;
}

export interface LinhaSimulacao {
  mes: Mes;
  parcelaCentavos: Centavos;
  folgaAntesCentavos: Centavos;
  folgaDepoisCentavos: Centavos;
  metaAntesCentavos: Centavos;
  metaDepoisCentavos: Centavos;
}

export interface ResultadoSimulacao {
  valorParcelaCentavos: Centavos;
  primeiraCompetencia: Mes;
  vencimentoPrimeira: Data | null;
  linhas: LinhaSimulacao[];
  /** Quanto a compra tira da meta, somando todos os meses. */
  comeDaMetaCentavos: Centavos;
  mesesQueComemMeta: number;
  cabe: boolean;
  /** metaId → meses de atraso (positivo = atrasa). */
  atrasos: Record<string, number>;
  datasAntes: Record<string, Mes>;
  datasDepois: Record<string, Mes>;
  /** Melhor dia para comprar no cartão (logo após o fechamento). */
  melhorDia: Data | null;
  primeiraCompetenciaNoMelhorDia: Mes | null;
  projecaoDepois: Projecao;
}

/** Valor da parcela: arredonda para cima, para nunca subestimar. */
export function valorDaParcela(total: Centavos, n: number): Centavos {
  return Math.ceil(total / Math.max(1, n));
}

export function simularCompra(
  situacao: SituacaoAtual,
  parametros: ParametrosPlano,
  compra: CompraSimulada,
  horizonteMeses = 60,
): ResultadoSimulacao {
  const cartao: CartaoCfg | undefined = situacao.cartoes.find(c => c.id === compra.forma);
  const n = cartao ? Math.max(1, compra.parcelas) : 1;
  const parcela = valorDaParcela(compra.valorCentavos, n);
  const primeira = cartao ? competenciaDaCompra(cartao, compra.data) : compra.data.slice(0, 7);

  const antes = projetar(situacao, parametros, { horizonteMeses });
  const situacaoDepois: SituacaoAtual = cartao
    ? {
        ...situacao,
        parcelas: [
          ...situacao.parcelas,
          {
            cartaoId: cartao.id, descricao: compra.descricao ?? 'Simulação', valorParcelaCentavos: parcela,
            parcelaAtual: 1, totalParcelas: n, competenciaParcelaAtual: primeira, somaNaInformada: true,
          },
        ],
      }
    : {
        ...situacao,
        eventosConhecidos: [
          ...situacao.eventosConhecidos,
          { data: compra.data, descricao: compra.descricao ?? 'Simulação', valorCentavos: compra.valorCentavos, tipo: 'saida' },
        ],
      };
  const depois = projetar(situacaoDepois, parametros, { horizonteMeses });

  const linhas: LinhaSimulacao[] = [];
  for (let i = 0; i < n; i++) {
    const idx = mesesEntre(situacao.mesInicial, primeira) + i;
    const a = antes.meses[idx];
    const d = depois.meses[idx];
    if (!a || !d) continue;
    linhas.push({
      mes: a.mes,
      parcelaCentavos: cartao ? parcela : compra.valorCentavos,
      folgaAntesCentavos: a.folgaCentavos,
      folgaDepoisCentavos: d.folgaCentavos,
      metaAntesCentavos: a.metaCentavos,
      metaDepoisCentavos: d.metaCentavos,
    });
  }

  let come = 0;
  let mesesComem = 0;
  for (let i = 0; i < antes.meses.length; i++) {
    const diff = antes.meses[i]!.metaCentavos - (depois.meses[i]?.metaCentavos ?? 0);
    if (diff > 0) { come += diff; mesesComem++; }
  }

  const atrasos: Record<string, number> = {};
  for (const id of new Set([...Object.keys(antes.datas), ...Object.keys(depois.datas)])) {
    const a = antes.datas[id];
    const d = depois.datas[id];
    if (a && d) atrasos[id] = mesesEntre(a, d);
    else if (a && !d) atrasos[id] = horizonteMeses;
  }

  const melhorDia = cartao ? melhorDiaDeCompra(cartao, compra.data) : null;
  return {
    valorParcelaCentavos: parcela,
    primeiraCompetencia: primeira,
    vencimentoPrimeira: cartao ? datasDaFatura(cartao, primeira).vencimento : null,
    linhas,
    comeDaMetaCentavos: come,
    mesesQueComemMeta: mesesComem,
    cabe: come === 0,
    atrasos,
    datasAntes: antes.datas,
    datasDepois: depois.datas,
    melhorDia,
    primeiraCompetenciaNoMelhorDia: cartao && melhorDia ? competenciaDaCompra(cartao, melhorDia) : null,
    projecaoDepois: depois,
  };
}
