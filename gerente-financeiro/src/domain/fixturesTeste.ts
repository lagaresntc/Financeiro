// Cenário fictício e redondo, compartilhado pelos testes. Nada de dados reais aqui.
import type { ParametrosPlano, SituacaoAtual } from './tipos';
import { ID_CONSIGNADO } from './projecao';

export function situacao(): SituacaoAtual {
  return {
    mesInicial: '2027-01',
    cartoes: [{ id: 'cartao', nome: 'Cartão', diaFechamento: 5, diaVencimento: 12 }],
    faturasInformadas: [],
    parcelas: [{ cartaoId: 'cartao', descricao: 'TV', valorParcelaCentavos: 10000, parcelaAtual: 2, totalParcelas: 3, competenciaParcelaAtual: '2027-01' }],
    consignadoCfg: { parcelaCentavos: 50000, k: 500, base: 1.02, mesBase: '2027-01' },
    consignado: { menorAberta: 2, maiorAberta: 11, nominalMaiorCentavos: 50000 },
    saldosMetas: { reserva: 0, sonho: 0 },
    eventosConhecidos: [],
  };
}

export function parametros(): ParametrosPlano {
  return {
    metaMensalCentavos: 200000,
    metaPorMes: {},
    extras: { abono: { pct: 100 }, decimoTerceiro: { pct: 100 }, licenca: { pct: 100 }, vendas: { pct: 100 }, consignadoLiberado: { pct: 100 } },
    destinos: [
      { metaId: 'reserva', ordem: 1, alvoCentavos: 100000 },
      { metaId: ID_CONSIGNADO, ordem: 2 },
      { metaId: 'sonho', ordem: 3, alvoCentavos: 1000000 },
    ],
    rendas: [
      { id: 'salario', nome: 'Salário', valorCentavos: 600000, regra: { tipo: 'mensal' } },
      { id: 'abono', nome: 'Abono', valorCentavos: 100000, regra: { tipo: 'meses', meses: [3] }, extra: 'abono' },
    ],
    fixas: [{ id: 'aluguel', nome: 'Aluguel', valorCentavos: 100000, forma: 'pix' }],
    orcamentoVariavel: { Mercado: 150000 },
    eventos: [],
    premissas: { cdiAnual: 0, caixinhaPctCdi: 1.2, caixinhaLimiteCentavos: 1000000, lciPctCdi: 0.9, margemMinimaCentavos: 50000 },
  };
}

