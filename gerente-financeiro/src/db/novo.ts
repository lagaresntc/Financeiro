import type { BancoFinanceiro } from './schema';
import type { Data, ParametrosPlano } from '../domain/tipos';

/** Parâmetros neutros para quem começa sem arquivo: tudo zerado, tudo editável no plano. */
export function parametrosVazios(): ParametrosPlano {
  return {
    metaMensalCentavos: 0,
    metaPorMes: {},
    extras: { abono: { pct: 100 }, decimoTerceiro: { pct: 100 }, licenca: { pct: 100 }, vendas: { pct: 100 }, consignadoLiberado: { pct: 100 } },
    destinos: [{ metaId: 'reserva', ordem: 1, alvoCentavos: 0 }],
    rendas: [],
    fixas: [],
    orcamentoVariavel: {},
    eventos: [],
    premissas: { cdiAnual: 0.1425, caixinhaPctCdi: 1.0, caixinhaLimiteCentavos: 0, lciPctCdi: 0.9, margemMinimaCentavos: 50000 },
  };
}

/** Primeira abertura sem arquivo: cria um plano vazio com uma reserva de emergência. */
export async function comecarDoZero(db: BancoFinanceiro, hoje: Data, agora = new Date()): Promise<void> {
  await db.transaction('rw', db.cenarios, db.metas, db.config, async () => {
    await db.metas.put({ id: 'reserva', nome: 'Reserva de emergência', alvoCentavos: 0, saldoCentavos: 0, ordem: 1 });
    await db.cenarios.put({ id: 'meu-plano', nome: 'Meu plano', ativo: true, criadoEm: agora.toISOString(), parametros: parametrosVazios() });
    await db.config.bulkPut([
      { chave: 'seedAplicadoEm', valor: agora.toISOString() },
      { chave: 'dataReferencia', valor: hoje },
    ]);
  });
}
