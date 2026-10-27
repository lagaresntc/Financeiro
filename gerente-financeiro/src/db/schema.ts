import Dexie, { type Table } from 'dexie';
import type { Centavos, Data, Mes, ParametrosPlano, Renda, Fixa, ConsignadoCfg, EstadoConsignado } from '../domain/tipos';

export interface CartaoDb {
  id: string;
  nome: string;
  banco?: string;
  titular?: string;
  diaFechamento: number;
  diaVencimento: number;
  vencimentos?: { aPartirDe: Mes; dia: number }[];
  limiteCentavos?: Centavos;
  principal: boolean;
  cashbackPct?: number;
  debitoAutomatico?: boolean;
  nota?: string;
}

export interface LancamentoDb {
  id?: number;
  data: Data;
  /** Valor de cada parcela (compra à vista: o valor total). */
  valorCentavos: Centavos;
  /** id do cartão, 'pix' ou 'dinheiro' */
  forma: string;
  categoria: string;
  descricao: string;
  parcelas: number;
  /** Primeira parcela que este lançamento cobre (seed: parcela atual de compras antigas). */
  parcelaInicial: number;
  /** Competência da `parcelaInicial` quando conhecida (seed) — senão calculada pela data. */
  faturaRef?: Mes;
  grupoParcelaId?: string;
  origem: 'manual' | 'importado' | 'seed';
}

export interface FaturaDb {
  id?: number;
  cartaoId: string;
  competencia: Mes;
  status: 'aberta' | 'fechada' | 'paga';
  saldoInformadoCentavos?: Centavos;
  dataInformado?: Data;
}

export interface OrcamentoDb { categoria: string; valorMensalCentavos: Centavos }

export interface ConsignadoDb {
  contrato: string;
  banco: string;
  cfg: ConsignadoCfg;
  totalParcelas: number;
  taxaMes: number;
  estado: EstadoConsignado;
}

export interface AntecipacaoDb { id?: number; data: Data | Mes; valorPagoCentavos: Centavos; deParcela: number; ateParcela: number; nota?: string }
export interface MetaDb { id: string; nome: string; alvoCentavos?: Centavos; saldoCentavos: Centavos; ordem: number }
export interface InvestimentoDb {
  id?: number; tipo: string; nome: string; valorCentavos?: Centavos; livreCentavos?: Centavos;
  taxa?: string; quantidade?: number; precoMedioCentavos?: Centavos; limiteCentavos?: Centavos; nota?: string;
}
export interface VeiculoDb { id: string; nome: string; ano: number; fipeCentavos?: Centavos; plano: 'manter' | 'vender'; status?: string; notas?: string }
export interface EventoDb { id?: number; data: Data; titulo: string; valorCentavos?: Centavos; orcamentoCentavos?: Centavos; tipo: string; nota?: string }
export interface CenarioDb { id: string; nome: string; ativo: boolean; criadoEm: string; parametros: ParametrosPlano }
export interface HistoricoPlanoDb { id?: number; data: string; cenarioId: string; resumo: string }
export interface FechamentoMesDb { competencia: Mes; planejadoGuardarCentavos: Centavos; guardadoRealCentavos: Centavos; gastoRealCentavos: Centavos }
export interface ConfigDb { chave: string; valor: unknown }

export class BancoFinanceiro extends Dexie {
  cartoes!: Table<CartaoDb, string>;
  lancamentos!: Table<LancamentoDb, number>;
  faturas!: Table<FaturaDb, number>;
  rendas!: Table<Renda, string>;
  fixas!: Table<Fixa, string>;
  orcamento!: Table<OrcamentoDb, string>;
  consignado!: Table<ConsignadoDb, string>;
  antecipacoes!: Table<AntecipacaoDb, number>;
  metas!: Table<MetaDb, string>;
  investimentos!: Table<InvestimentoDb, number>;
  veiculos!: Table<VeiculoDb, string>;
  eventos!: Table<EventoDb, number>;
  cenarios!: Table<CenarioDb, string>;
  historicoPlano!: Table<HistoricoPlanoDb, number>;
  fechamentoMes!: Table<FechamentoMesDb, string>;
  config!: Table<ConfigDb, string>;

  constructor(nome = 'gerente-financeiro') {
    super(nome);
    this.version(1).stores({
      cartoes: 'id',
      lancamentos: '++id, data, forma, categoria, faturaRef, grupoParcelaId',
      faturas: '++id, [cartaoId+competencia], cartaoId, competencia, status',
      rendas: 'id',
      fixas: 'id',
      orcamento: 'categoria',
      consignado: 'contrato',
      antecipacoes: '++id, data',
      metas: 'id, ordem',
      investimentos: '++id, tipo',
      veiculos: 'id',
      eventos: '++id, data',
      cenarios: 'id, ativo',
      historicoPlano: '++id, data',
      fechamentoMes: 'competencia',
      config: 'chave',
    });
  }
}

export const TABELAS = [
  'cartoes', 'lancamentos', 'faturas', 'rendas', 'fixas', 'orcamento', 'consignado', 'antecipacoes',
  'metas', 'investimentos', 'veiculos', 'eventos', 'cenarios', 'historicoPlano', 'fechamentoMes', 'config',
] as const;
