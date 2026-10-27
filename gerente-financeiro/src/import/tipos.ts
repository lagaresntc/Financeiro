import type { Centavos, Data } from '../domain/tipos';

/** Lançamento lido de uma fatura. Estornos vêm com centavos negativos. */
export interface LancamentoImportado {
  data: Data;
  descricao: string;
  valorCentavos: Centavos;
  parcela?: { k: number; n: number };
  internacional?: boolean;
}
