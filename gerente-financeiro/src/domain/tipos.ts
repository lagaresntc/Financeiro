// Tipos do domínio. Dinheiro sempre em centavos inteiros.

export type Centavos = number;
/** 'YYYY-MM' — competência de fatura ou mês da projeção. */
export type Mes = string;
/** 'YYYY-MM-DD' */
export type Data = string;

export interface CartaoCfg {
  id: string;
  nome: string;
  diaFechamento: number;
  diaVencimento: number;
  /** Mudanças de vencimento ao longo do tempo (ex.: passa a vencer dia 12 a partir de dez/2026). */
  vencimentos?: { aPartirDe: Mes; dia: number }[];
  /** Mensalidade isenta se a fatura passar de um gasto mínimo OU houver um saldo guardado mínimo. */
  isencao?: { mensalidadeCentavos: Centavos; gastoMinCentavos?: Centavos; saldoMinCentavos?: Centavos; metaIdSaldo?: string };
}

export type ChaveExtra = 'abono' | 'decimoTerceiro' | 'licenca' | 'vendas' | 'consignadoLiberado';

export type RegraRenda =
  | { tipo: 'mensal' }
  | { tipo: 'meses'; meses: number[] }
  | { tipo: 'unica'; mes: Mes; substitui?: string[] }
  | { tipo: 'datas'; datas: Data[] };

export interface Renda {
  id: string;
  nome: string;
  valorCentavos: Centavos;
  regra: RegraRenda;
  dia?: number | '5du';
  inicio?: Mes;
  fim?: Mes;
  /** Se for um extra, qual chave de `ParametrosPlano.extras` decide quanto vai para o plano. */
  extra?: ChaveExtra;
}

export interface Fixa {
  id: string;
  nome: string;
  valorCentavos: Centavos;
  /** id do cartão, 'pix' ou 'dinheiro' */
  forma: string;
  inicio?: Mes;
  fim?: Mes;
}

export interface EventoPlano {
  data: Data;
  descricao: string;
  valorCentavos: Centavos;
  tipo: 'entrada' | 'saida';
}

export interface Destino {
  metaId: string;
  ordem: number;
  /** Sem alvo = recebe tudo o que sobrar (ex.: investimentos). Ignorado para o consignado. */
  alvoCentavos?: Centavos;
  /** Mês em que você quer a meta pronta (para calcular quanto guardar por mês). */
  prazo?: Mes;
}

export type MetaDoMes = Centavos | '13o' | 'sobra';

export interface Premissas {
  cdiAnual: number;
  caixinhaPctCdi: number;
  caixinhaLimiteCentavos: Centavos;
  lciPctCdi: number;
  margemMinimaCentavos: Centavos;
}

export interface ParametrosPlano {
  metaMensalCentavos: Centavos;
  metaPorMes: Record<Mes, MetaDoMes>;
  /** pct de 0 a 100 */
  extras: Record<ChaveExtra, { pct: number }>;
  destinos: Destino[];
  rendas: Renda[];
  fixas: Fixa[];
  orcamentoVariavel: Record<string, Centavos>;
  eventos: EventoPlano[];
  premissas: Premissas;
}

export interface ConsignadoCfg {
  parcelaCentavos: Centavos;
  /** custo(t, m) = k × base^m / base^t, com k em reais */
  k: number;
  base: number;
  mesBase: Mes;
}

export interface EstadoConsignado {
  menorAberta: number;
  maiorAberta: number;
  /** Valor nominal que ainda resta da maior parcela aberta (pode ser parcial). */
  nominalMaiorCentavos: Centavos;
}

export interface ParcelaEmAndamento {
  cartaoId: string;
  descricao: string;
  valorParcelaCentavos: Centavos;
  parcelaAtual: number;
  totalParcelas: number;
  competenciaParcelaAtual: Mes;
  /** Lançada depois do saldo informado da fatura: soma mesmo nos meses com fatura informada. */
  somaNaInformada?: boolean;
}

export interface FaturaInformada {
  cartaoId: string;
  competencia: Mes;
  valorCentavos: Centavos;
}

/** O que é real hoje. A projeção sempre recomeça daqui. */
export interface SituacaoAtual {
  mesInicial: Mes;
  cartoes: CartaoCfg[];
  faturasInformadas: FaturaInformada[];
  parcelas: ParcelaEmAndamento[];
  consignadoCfg: ConsignadoCfg;
  consignado: EstadoConsignado;
  /** Saldo atual de cada meta (fora o consignado). */
  saldosMetas: Record<string, Centavos>;
  /** Saídas e entradas já certas que não são do plano (ex.: Pix da hospedagem). */
  eventosConhecidos: EventoPlano[];
}
