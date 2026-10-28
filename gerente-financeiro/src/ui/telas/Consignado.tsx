import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/db';
import { useDados } from '../dados';
import { Aviso, Barra, CampoNumero, CampoTexto, CampoValor, Reais, Topo, toast } from '../componentes';
import { href } from '../rotas';
import { antecipar, parcelasAbertas, projetarConsignado, quitado, saldoNominal, saldoParaQuitar } from '../../domain/consignado';
import { formatarData, formatarMes, mesesEntre } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';
import { ID_CONSIGNADO } from '../../domain/projecao';

export default function Consignado() {
  const d = useDados();
  const reg = d.consignado;
  if (!reg || reg.cfg.parcelaCentavos <= 0) {
    return (
      <main className="tela">
        <Topo titulo="Consignado" />
        <section className="cartao coluna">
          <p className="fraco">Nenhum consignado cadastrado.</p>
          <a className="botao cheio" href={href('ajustes', 'consignado')}>Cadastrar consignado</a>
        </section>
      </main>
    );
  }
  return <ComConsignado />;
}

function ComConsignado() {
  const d = useDados();
  const reg = d.consignado!;
  const cfg = d.situacao.consignadoCfg;
  const estado = d.situacao.consignado;
  const mes = d.situacao.mesInicial;
  const [extraAgora, setExtraAgora] = useState<number | undefined>();
  const [extraMensal, setExtraMensal] = useState<number | undefined>();

  const soFolha = useMemo(() => projetarConsignado(cfg, estado, mes), [cfg, estado, mes]);
  const comExtra = useMemo(
    () => projetarConsignado(cfg, estado, mes, { extraAgoraCentavos: extraAgora ?? 0, extraMensalCentavos: extraMensal ?? 0 }),
    [cfg, estado, mes, extraAgora, extraMensal],
  );
  const simulando = (extraAgora ?? 0) > 0 || (extraMensal ?? 0) > 0;
  const agora = extraAgora ? antecipar(cfg, estado, mes, extraAgora) : null;
  const pagas = reg.totalParcelas - parcelasAbertas(estado);

  if (quitado(estado)) {
    return <main className="tela"><Topo titulo="Consignado" /><Aviso nivel="ok" titulo="Consignado quitado!">A parcela volta para o salário.</Aviso><Historico /></main>;
  }

  const mesesAntes = soFolha.mesQuitacao && comExtra.mesQuitacao ? mesesEntre(comExtra.mesQuitacao, soFolha.mesQuitacao) : 0;
  const economia = soFolha.jurosCentavos - comExtra.jurosCentavos;
  const pontos = soFolha.meses.map((m, i) => ({
    mes: formatarMes(m.mes),
    folha: m.saldoCentavos / 100,
    ...(simulando ? { extra: (comExtra.meses[i]?.saldoCentavos ?? 0) / 100 } : {}),
  }));

  return (
    <main className="tela">
      <Topo titulo="Consignado" acao={<a className="botao pequeno secundario" href={href('ajustes', 'consignado')}>Editar</a>} />

      <section className="cartao coluna">
        <div className="linha"><span className="pequeno fraco">Falta para quitar hoje (estimado)</span><span className="pequeno fraco">{reg.banco}</span></div>
        <span className="numero-grande"><Reais v={saldoParaQuitar(cfg, estado, mes)} /></span>
        <Barra fracao={pagas / reg.totalParcelas} />
        <div className="linha pequeno fraco">
          <span>{pagas} de {reg.totalParcelas} parcelas pagas</span>
          <span>{parcelasAbertas(estado)} abertas ({estado.menorAberta} a {estado.maiorAberta})</span>
        </div>
        <div className="grade-2">
          <div><span className="pequeno fraco">Só pela folha, acaba em</span><br /><strong>{soFolha.mesQuitacao ? formatarMes(soFolha.mesQuitacao) : '—'}</strong></div>
          <div><span className="pequeno fraco">Pelo seu plano, acaba em</span><br /><strong>{d.projecao.datas[ID_CONSIGNADO] ? formatarMes(d.projecao.datas[ID_CONSIGNADO]!) : '—'}</strong></div>
          <div><span className="pequeno fraco">Nominal restante</span><br /><strong><Reais v={saldoNominal(cfg, estado)} /></strong></div>
          <div><span className="pequeno fraco">Juros só pela folha</span><br /><strong><Reais v={soFolha.jurosCentavos} /></strong></div>
        </div>
        <p className="pequeno fraco">O valor exato é o do app do banco. Aqui é estimativa de {formatarMes(mes)}.</p>
      </section>

      <section className="cartao coluna">
        <h2>Se eu amortizar…</h2>
        <div className="grade-2">
          <CampoValor rotulo="Agora (uma vez)" valor={extraAgora} onChange={setExtraAgora} />
          <CampoValor rotulo="Todo mês" valor={extraMensal} onChange={setExtraMensal} />
        </div>
        {simulando && comExtra.mesQuitacao && (
          <Aviso nivel="ok" titulo={`Acaba em ${formatarMes(comExtra.mesQuitacao)}${mesesAntes > 0 ? `, ${mesesAntes} ${mesesAntes === 1 ? 'mês' : 'meses'} antes` : ''}`}>
            Economiza {formatarReais(Math.max(0, economia))} de juros (paga {formatarReais(comExtra.totalPagoCentavos)} no total, contra {formatarReais(soFolha.totalPagoCentavos)} só pela folha).
          </Aviso>
        )}
        {agora && (
          <p className="pequeno">
            {agora.quitadas ? <>Hoje, {formatarReais(agora.pagoCentavos)} eliminam as parcelas <strong>{agora.quitadas.de} a {agora.quitadas.ate}</strong></> : <>Hoje, {formatarReais(agora.pagoCentavos)} não quitam uma parcela inteira</>}
            {agora.abatidoParcialCentavos > 0 ? ` e abatem ${formatarReais(agora.abatidoParcialCentavos)} da parcela ${agora.estado.maiorAberta}` : ''}.
          </p>
        )}

        <div className="legenda" aria-hidden>
          <span><i style={{ background: 'var(--serie-1)' }} />Só a folha</span>
          {simulando && <span><i style={{ background: 'var(--serie-2)' }} />Amortizando</span>}
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--borda)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="dica-grafico"><strong>{label}</strong>
                  {payload.map(p => <div key={String(p.dataKey)}>{p.dataKey === 'folha' ? 'Só a folha' : 'Amortizando'}: {formatarReais(Math.round(Number(p.value) * 100))}</div>)}
                </div>
              ) : null} />
              <Line type="monotone" dataKey="folha" stroke="var(--serie-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
              {simulando && <Line type="monotone" dataKey="extra" stroke="var(--serie-2)" strokeWidth={2} dot={false} isAnimationActive={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="pequeno fraco">Saldo estimado para quitar, mês a mês.</p>
      </section>

      <RegistrarAntecipacao sugestao={agora ? { valor: agora.pagoCentavos, de: agora.quitadas?.de, ate: agora.quitadas?.ate } : undefined} />
      <Historico />
    </main>
  );
}

function RegistrarAntecipacao({ sugestao }: { sugestao?: { valor?: number; de?: number; ate?: number } }) {
  const d = useDados();
  const reg = d.consignado!;
  const cfg = d.situacao.consignadoCfg;
  const estado = d.situacao.consignado;
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<{ data: string; valor?: number; de?: number; ate?: number }>({ data: d.hoje });
  const valido = !!form.valor && !!form.de && !!form.ate && form.ate <= form.de;

  async function salvar() {
    if (!valido) return;
    if (form.de! < estado.maiorAberta && !confirm(`As parcelas abertas vão até a ${estado.maiorAberta}. Registrar da ${form.de} à ${form.ate} mesmo assim?`)) return;
    const novo = { ...estado, maiorAberta: Math.min(estado.maiorAberta, form.ate! - 1), nominalMaiorCentavos: cfg.parcelaCentavos };
    await db.transaction('rw', db.antecipacoes, db.consignado, async () => {
      await db.antecipacoes.add({ data: form.data, valorPagoCentavos: form.valor!, deParcela: form.de!, ateParcela: form.ate! });
      await db.consignado.update(reg.contrato, { estado: novo, estadoEm: d.situacao.mesInicial });
    });
    setAberto(false);
    toast('Antecipação registrada');
  }

  if (!aberto) {
    return (
      <button className="botao cheio" onClick={() => { setForm({ data: d.hoje, ...sugestao }); setAberto(true); }}>
        Registrar amortização feita no banco
      </button>
    );
  }
  return (
    <section className="cartao coluna">
      <h2>Registrar amortização</h2>
      <p className="pequeno fraco">Confira no app do banco o valor pago e as parcelas quitadas (ex.: da 95 à 80).</p>
      <CampoTexto rotulo="Data" tipo="date" valor={form.data} onChange={v => setForm({ ...form, data: v })} />
      <CampoValor rotulo="Valor pago" valor={form.valor} onChange={v => setForm({ ...form, valor: v })} />
      <div className="grade-2">
        <CampoNumero rotulo="Da parcela" valor={form.de} onChange={v => setForm({ ...form, de: v })} />
        <CampoNumero rotulo="Até a parcela" valor={form.ate} onChange={v => setForm({ ...form, ate: v })} />
      </div>
      <div className="linha">
        <button className="botao secundario pequeno" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="botao pequeno" onClick={salvar} disabled={!valido}>Salvar</button>
      </div>
    </section>
  );
}

function Historico() {
  const d = useDados();
  if (d.antecipacoes.length === 0) return null;
  return (
    <section className="cartao">
      <h2>Amortizações feitas</h2>
      <div className="lista">
        {[...d.antecipacoes].sort((a, b) => b.data.localeCompare(a.data)).map(a => (
          <div key={a.id} className="linha pequeno">
            <span>{a.data.length > 7 ? formatarData(a.data) : formatarMes(a.data)} · parcelas {a.deParcela} a {a.ateParcela}</span>
            <strong><Reais v={a.valorPagoCentavos} /></strong>
          </div>
        ))}
      </div>
    </section>
  );
}
