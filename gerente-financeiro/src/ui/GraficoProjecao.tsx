import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Projecao } from '../domain/projecao';
import { formatarMes } from '../domain/datas';
import { formatarReais } from '../domain/dinheiro';

export interface SerieGrafico { id: string; nome: string }

/** Saldo de cada meta mês a mês (consignado: saldo para quitar). Cores fixas pela ordem das séries. */
export function GraficoProjecao({ projecao, series, ate }: { projecao: Projecao; series: SerieGrafico[]; ate?: string }) {
  const visiveis = series.slice(0, 4);
  const pontos = projecao.meses
    .filter(m => !ate || m.mes <= ate)
    .map(m => {
      const p: Record<string, number | string> = { mes: formatarMes(m.mes) };
      for (const s of visiveis) p[s.id] = (m.saldos[s.id] ?? 0) / 100;
      return p;
    });
  if (pontos.length < 2 || visiveis.length === 0) return null;
  return (
    <div className="coluna">
      <div className="legenda" aria-hidden>
        {visiveis.map((s, i) => <span key={s.id}><i style={{ background: `var(--serie-${i + 1})` }} />{s.nome}</span>)}
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--borda)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }} tickLine={false} axisLine={false} width={44}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))}
            />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="dica-grafico">
                    <strong>{label}</strong>
                    {payload.map(p => (
                      <div key={String(p.dataKey)}>{visiveis.find(s => s.id === p.dataKey)?.nome}: {formatarReais(Math.round(Number(p.value) * 100))}</div>
                    ))}
                  </div>
                ) : null
              }
            />
            {visiveis.map((s, i) => (
              <Line key={s.id} type="monotone" dataKey={s.id} stroke={`var(--serie-${i + 1})`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
