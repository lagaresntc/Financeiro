import { Fragment } from 'react';
import type { MetaDb } from '../db/schema';
import type { Mes, ParametrosPlano } from '../domain/tipos';
import type { Projecao } from '../domain/projecao';
import { ID_CONSIGNADO, ID_INVESTIMENTOS } from '../domain/projecao';
import { formatarMes, mesesEntre } from '../domain/datas';
import { Reais } from './componentes';
import { nomeMeta } from './dados';
import type { SerieGrafico } from './GraficoProjecao';

/** Metas que aparecem nas datas e no gráfico, na ordem do plano. */
export function seriesDoPlano(p: ParametrosPlano, metas: MetaDb[], temConsignado: boolean): SerieGrafico[] {
  return [...p.destinos]
    .sort((a, b) => a.ordem - b.ordem)
    .filter(d => (d.metaId === ID_CONSIGNADO ? temConsignado : (d.alvoCentavos ?? 0) > 0))
    .map(d => ({ id: d.metaId, nome: nomeMeta(d.metaId, metas) }));
}

export function DatasPrevistas({ projecao, series, antes }: { projecao: Projecao; series: SerieGrafico[]; antes?: Record<string, Mes> }) {
  if (series.length === 0) return <p className="vazio">Sem metas com alvo. Adicione no editor do plano.</p>;
  return (
    <div className="grade-2">
      {series.map(s => {
        const data = projecao.datas[s.id];
        const anterior = antes?.[s.id];
        const delta = data && anterior ? mesesEntre(anterior, data) : 0;
        return (
          <div key={s.id} className="cartao coluna" style={{ gap: 4, background: 'var(--superficie-2)' }}>
            <span className="pequeno fraco">{s.id === ID_CONSIGNADO ? `${s.nome} quitado` : `${s.nome} pronta`}</span>
            <strong style={{ fontSize: '1.3rem' }}>{data ? formatarMes(data) : 'fora do horizonte'}</strong>
            {antes && delta !== 0 && (
              <span className={`pequeno ${delta > 0 ? 'vermelho' : 'verde'}`}>
                {delta > 0 ? `${delta} ${delta === 1 ? 'mês' : 'meses'} depois` : `${-delta} ${delta === -1 ? 'mês' : 'meses'} antes`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Tabela mês a mês. Linhas com aviso ficam marcadas e mostram o aviso embaixo. */
export function TabelaProjecao({ projecao, metas, ate }: { projecao: Projecao; metas: MetaDb[]; ate?: Mes }) {
  const meses = projecao.meses.filter(m => !ate || m.mes <= ate);
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr><th>Mês</th><th>Renda</th><th>Saídas</th><th>Variável</th><th>Guardar</th><th>Folga</th><th>Destino</th></tr>
        </thead>
        <tbody>
          {meses.map(m => {
            const destino = Object.entries(m.aportes)
              .filter(([, v]) => v > 0)
              .map(([id, v]) => `${id === ID_INVESTIMENTOS ? 'Investir' : nomeMeta(id, metas)} ${Math.round(v / 100).toLocaleString('pt-BR')}`)
              .join(' · ');
            return (
              <Fragment key={m.mes}>
                <tr className={m.avisos.length ? 'marcado' : undefined}>
                  <td>{formatarMes(m.mes)}</td>
                  <td><Reais v={m.rendaCentavos} /></td>
                  <td><Reais v={m.saidasCentavos} /></td>
                  <td><Reais v={m.variavelCentavos} /></td>
                  <td><Reais v={m.metaCentavos} /></td>
                  <td><Reais v={m.folgaCentavos} /></td>
                  <td style={{ textAlign: 'left' }} className="pequeno">{destino || '—'}</td>
                </tr>
                {m.avisos.map(a => (
                  <tr key={a}><td colSpan={7} className="pequeno amarelo" style={{ textAlign: 'left', whiteSpace: 'normal' }}>⚠ {a}</td></tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
