import type { Centavos, Destino } from './tipos';
import { ID_CONSIGNADO, ID_INVESTIMENTOS } from './projecao';

export interface Distribuicao {
  /** metaId → quanto vai para ela (inclui 'investimentos' se sobrar). */
  porMeta: Record<string, Centavos>;
  /** Quanto deveria ir para antecipar o consignado (o usuário paga no app do banco e registra). */
  consignadoCentavos: Centavos;
}

/**
 * Distribui um valor guardado pelos destinos, na ordem do plano — a mesma regra da projeção:
 * metas com alvo até completar, consignado até quitar, e o resto para a primeira meta sem alvo
 * (ou investimentos).
 */
export function distribuirGuardado(
  destinos: Destino[],
  saldos: Record<string, Centavos>,
  saldoConsignadoCentavos: Centavos,
  valor: Centavos,
): Distribuicao {
  const porMeta: Record<string, Centavos> = {};
  let consignado = 0;
  let resto = valor;
  for (const d of [...destinos].sort((a, b) => a.ordem - b.ordem)) {
    if (resto <= 0) break;
    if (d.metaId === ID_CONSIGNADO) {
      consignado = Math.min(resto, saldoConsignadoCentavos);
      resto -= consignado;
      continue;
    }
    const vai = d.alvoCentavos === undefined ? resto : Math.min(resto, Math.max(0, d.alvoCentavos - (saldos[d.metaId] ?? 0)));
    if (vai > 0) {
      porMeta[d.metaId] = (porMeta[d.metaId] ?? 0) + vai;
      resto -= vai;
    }
  }
  if (resto > 0) porMeta[ID_INVESTIMENTOS] = (porMeta[ID_INVESTIMENTOS] ?? 0) + resto;
  return { porMeta, consignadoCentavos: consignado };
}
