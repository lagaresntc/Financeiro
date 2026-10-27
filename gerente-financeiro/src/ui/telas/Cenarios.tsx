import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/db';
import { useDados, nomeMeta } from '../dados';
import { Reais, Topo, toast } from '../componentes';
import { href } from '../rotas';
import { seriesDoPlano } from '../planoComum';
import { projetar } from '../../domain/projecao';
import { quitado } from '../../domain/consignado';
import { formatarMes } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';

export default function Cenarios() {
  const d = useDados();
  const historico = useLiveQuery(() => db.historicoPlano.orderBy('data').reverse().limit(10).toArray()) ?? [];
  // Sem escolha do usuário, compara os 3 primeiros (inclui cenários recém-criados).
  const [escolha, setComparar] = useState<string[] | null>(null);
  const comparar = escolha ?? d.cenarios.slice(0, 3).map(c => c.id);
  const temConsignado = !!d.consignado && !quitado(d.situacao.consignado);

  const projecoes = useMemo(
    () => Object.fromEntries(d.cenarios.map(c => [c.id, projetar(d.situacao, c.parametros, { horizonteMeses: 60 })])),
    [d.cenarios, d.situacao],
  );
  const series = seriesDoPlano(d.parametros, d.metas, temConsignado);
  const [metaGrafico, setMetaGrafico] = useState(series[series.length - 1]?.id ?? '');
  const escolhidos = d.cenarios.filter(c => comparar.includes(c.id)).slice(0, 3);

  async function ativar(id: string) {
    const novo = d.cenarios.find(c => c.id === id)!;
    if (!confirm(`Usar "${novo.nome}" como plano ativo? O Início e os alertas passam a seguir este cenário.`)) return;
    await db.transaction('rw', db.cenarios, db.historicoPlano, async () => {
      for (const c of d.cenarios) await db.cenarios.update(c.id, { ativo: c.id === id });
      const datas = projecoes[id]!.datas;
      const resumo = `${d.cenario.nome} → ${novo.nome}. ` + Object.entries(datas).map(([m, mes]) => `${nomeMeta(m, d.metas)}: ${formatarMes(mes)}`).join(', ');
      await db.historicoPlano.add({ data: new Date().toISOString(), cenarioId: id, resumo });
    });
    toast(`Plano ativo: ${novo.nome}`);
  }

  async function duplicar(id: string) {
    const base = d.cenarios.find(c => c.id === id)!;
    const nome = prompt('Nome do novo cenário:', `${base.nome} (cópia)`);
    if (!nome) return;
    await db.cenarios.add({ id: `cenario-${Math.random().toString(36).slice(2, 8)}`, nome, ativo: false, criadoEm: new Date().toISOString(), parametros: structuredClone(base.parametros) });
  }

  async function renomear(id: string) {
    const c = d.cenarios.find(x => x.id === id)!;
    const nome = prompt('Novo nome:', c.nome);
    if (nome) await db.cenarios.update(id, { nome });
  }

  async function apagar(id: string) {
    const c = d.cenarios.find(x => x.id === id)!;
    if (c.ativo) return alert('Ative outro cenário antes de apagar este.');
    if (confirm(`Apagar o cenário "${c.nome}"?`)) await db.cenarios.delete(id);
  }

  const pontos = useMemo(() => {
    const ate = escolhidos.map(c => projecoes[c.id]!.datas[metaGrafico]).filter(Boolean).sort().pop();
    const base = projecoes[escolhidos[0]?.id ?? '']?.meses ?? [];
    return base.filter(m => !ate || m.mes <= ate).map((m, i) => {
      const p: Record<string, number | string> = { mes: formatarMes(m.mes) };
      for (const c of escolhidos) p[c.id] = (projecoes[c.id]!.meses[i]?.saldos[metaGrafico] ?? 0) / 100;
      return p;
    });
  }, [escolhidos, projecoes, metaGrafico]);

  return (
    <main className="tela">
      <Topo titulo="Cenários" comVoltar />
      <section className="cartao">
        <div className="lista">
          {d.cenarios.map(c => (
            <div key={c.id} className="coluna" style={{ gap: 8 }}>
              <label className="marcador">
                <input type="checkbox" checked={comparar.includes(c.id)} onChange={e => setComparar(e.target.checked ? [...comparar, c.id] : comparar.filter(x => x !== c.id))} aria-label="Comparar" />
                <strong style={{ flex: 1 }}>{c.nome}</strong>
                {c.ativo && <span className="selo paga">Ativo</span>}
              </label>
              <div className="chips">
                {!c.ativo && <button className="chip" onClick={() => ativar(c.id)}>Ativar</button>}
                <a className="chip" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={href('plano', 'editor', c.id)}>Editar</a>
                <button className="chip" onClick={() => duplicar(c.id)}>Duplicar</button>
                <button className="chip" onClick={() => renomear(c.id)}>Renomear</button>
                {!c.ativo && <button className="chip" onClick={() => apagar(c.id)}>Apagar</button>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {escolhidos.length >= 2 && (
        <section className="cartao coluna">
          <h2>Lado a lado</h2>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th></th>{escolhidos.map(c => <th key={c.id}>{c.nome}</th>)}</tr></thead>
              <tbody>
                {series.map(s => (
                  <tr key={s.id}>
                    <td>{s.nome}</td>
                    {escolhidos.map(c => <td key={c.id}>{projecoes[c.id]!.datas[s.id] ? formatarMes(projecoes[c.id]!.datas[s.id]!) : '—'}</td>)}
                  </tr>
                ))}
                {temConsignado && (
                  <tr><td>Juros do consignado</td>{escolhidos.map(c => <td key={c.id}><Reais v={projecoes[c.id]!.jurosConsignadoCentavos} /></td>)}</tr>
                )}
                <tr><td>Meta mensal</td>{escolhidos.map(c => <td key={c.id}><Reais v={c.parametros.metaMensalCentavos} /></td>)}</tr>
              </tbody>
            </table>
          </div>

          {series.length > 0 && (
            <>
              <label className="campo"><span>Saldo mês a mês de</span>
                <select className="entrada" value={metaGrafico} onChange={e => setMetaGrafico(e.target.value)}>
                  {series.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </label>
              <div className="legenda">
                {escolhidos.map((c, i) => <span key={c.id}><i style={{ background: `var(--serie-${i + 1})` }} />{c.nome}</span>)}
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--borda)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="dica-grafico"><strong>{label}</strong>
                        {payload.map(p => <div key={String(p.dataKey)}>{escolhidos.find(c => c.id === p.dataKey)?.nome}: {formatarReais(Math.round(Number(p.value) * 100))}</div>)}
                      </div>
                    ) : null} />
                    {escolhidos.map((c, i) => <Line key={c.id} type="monotone" dataKey={c.id} stroke={`var(--serie-${i + 1})`} strokeWidth={2} dot={false} isAnimationActive={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
      )}
      {escolhidos.length < 2 && d.cenarios.length >= 2 && <p className="fraco pequeno">Marque 2 ou 3 cenários para comparar.</p>}

      {historico.length > 0 && (
        <section className="cartao">
          <h2>Histórico do plano ativo</h2>
          <div className="lista">
            {historico.map(h => <div key={h.id} className="pequeno"><span className="fraco">{new Date(h.data).toLocaleDateString('pt-BR')}</span> · {h.resumo}</div>)}
          </div>
        </section>
      )}
    </main>
  );
}
