import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useDados, nomeMeta } from '../dados';
import { Aviso, CampoNumero, CampoTexto, CampoValor, Reais, Topo, toast } from '../componentes';
import { href } from '../rotas';
import { GraficoProjecao } from '../GraficoProjecao';
import { DatasPrevistas, TabelaProjecao, seriesDoPlano } from '../planoComum';
import { ID_CONSIGNADO, ID_INVESTIMENTOS, projetar } from '../../domain/projecao';
import { antecipar, parcelasAbertas, quitado, saldoNominal, saldoParaQuitar } from '../../domain/consignado';
import { distribuirGuardado } from '../../domain/guardar';
import { formatarData, formatarDiaMes, formatarMes, mesDe } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';
import { datasDaFatura } from '../../domain/faturas';
import { cartaoCfg } from '../../db/situacao';

export default function Plano() {
  const d = useDados();
  const temConsignado = !!d.consignado && d.consignado.cfg.parcelaCentavos > 0;
  const series = seriesDoPlano(d.parametros, d.metas, temConsignado && !quitado(d.situacao.consignado));
  const ultimaData = Object.values(d.projecao.datas).sort().pop();

  return (
    <main className="tela">
      <Topo titulo="Plano" />
      <section className="cartao coluna">
        <div className="linha">
          <h2 style={{ margin: 0 }}>{d.cenario.nome}</h2>
          <span className="pequeno"><a href={href('plano', 'cenarios')}>Cenários</a></span>
        </div>
        <DatasPrevistas projecao={d.projecao} series={series} />
        {temConsignado && d.projecao.jurosConsignadoCentavos > 0 && (
          <p className="pequeno fraco">Juros que ainda serão pagos no consignado: <Reais v={d.projecao.jurosConsignadoCentavos} /></p>
        )}
        <a className="botao cheio" href={href('plano', 'editor')}>Editar o plano / e se…?</a>
      </section>

      <RealVersusPlano />
      <Checklist />
      {temConsignado && <Consignado />}

      <section className="cartao coluna">
        <h2>Projeção mês a mês</h2>
        <GraficoProjecao projecao={d.projecao} series={series} ate={ultimaData} />
        <TabelaProjecao projecao={d.projecao} metas={d.metas} ate={ultimaData && ultimaData >= d.situacao.mesInicial ? ultimaData : undefined} />
      </section>
    </main>
  );
}

/** Compara o que foi planejado com o que aconteceu no último mês fechado. */
function RealVersusPlano() {
  const d = useDados();
  const ultimo = [...d.fechamentos].filter(f => f.competencia < mesDe(d.hoje) || f.competencia === d.ciclo.mes).sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
  const abaixo = !!ultimo && ultimo.guardadoRealCentavos < ultimo.planejadoGuardarCentavos;
  const comoPlanejado = useMemoProjecaoComoPlanejado(abaixo && ultimo ? ultimo.planejadoGuardarCentavos - ultimo.guardadoRealCentavos : 0);
  if (!ultimo) return null;
  const mudou = Object.entries(d.projecao.datas).filter(([id, mes]) => comoPlanejado?.[id] && comoPlanejado[id] !== mes);
  return (
    <Aviso nivel={abaixo ? 'atencao' : 'ok'} titulo={`${formatarMes(ultimo.competencia)}: guardou ${formatarReais(ultimo.guardadoRealCentavos)} de ${formatarReais(ultimo.planejadoGuardarCentavos)}`}>
      {abaixo
        ? mudou.length
          ? mudou.map(([id, mes]) => `${nomeMeta(id, d.metas)} agora previsto para ${formatarMes(mes)}.`).join(' ')
          : 'As datas do plano não mudaram.'
        : 'No plano. As datas já partem do que você guardou de fato.'}
    </Aviso>
  );
}

/** Datas se a diferença tivesse sido guardada (para dizer o que mudou). */
function useMemoProjecaoComoPlanejado(diferenca: number) {
  const d = useDados();
  return useMemo(() => {
    if (diferenca <= 0) return null;
    const destino = [...d.parametros.destinos].sort((a, b) => a.ordem - b.ordem).find(x => x.metaId !== ID_CONSIGNADO);
    const saldos = { ...d.situacao.saldosMetas };
    if (destino) saldos[destino.metaId] = (saldos[destino.metaId] ?? 0) + diferenca;
    return projetar({ ...d.situacao, saldosMetas: saldos }, d.parametros, { horizonteMeses: 60 }).datas;
  }, [d, diferenca]);
}

function Checklist() {
  const d = useDados();
  const mes = d.ciclo.mes;
  const chave = `checklist:${mes}`;
  const marcados = (useLiveQuery(() => db.config.get(chave), [chave])?.valor ?? {}) as Record<string, boolean>;
  const linha = d.projecao.meses.find(m => m.mes === mes) ?? d.projecao.meses[0];
  const fechamento = d.fechamentos.find(f => f.competencia === mes);
  const [guardando, setGuardando] = useState(false);
  const [valorGuardado, setValorGuardado] = useState<number | undefined>(linha?.metaCentavos);

  async function marcar(id: string, v: boolean) {
    await db.config.put({ chave, valor: { ...marcados, [id]: v } });
  }

  async function confirmarGuardado() {
    if (valorGuardado === undefined) return;
    const consignadoSaldo = d.consignado && !quitado(d.situacao.consignado) ? saldoParaQuitar(d.situacao.consignadoCfg, d.situacao.consignado, d.situacao.mesInicial) : 0;
    const dist = distribuirGuardado(d.parametros.destinos, d.situacao.saldosMetas, consignadoSaldo, valorGuardado);
    await db.transaction('rw', db.metas, db.fechamentoMes, db.config, async () => {
      for (const [id, v] of Object.entries(dist.porMeta)) {
        const m = await db.metas.get(id);
        if (m) await db.metas.update(id, { saldoCentavos: m.saldoCentavos + v });
        else await db.metas.add({ id, nome: id === ID_INVESTIMENTOS ? 'Investimentos' : id, saldoCentavos: v, ordem: 99 });
      }
      await db.fechamentoMes.put({
        competencia: mes,
        planejadoGuardarCentavos: linha?.metaPlanejadaCentavos ?? 0,
        guardadoRealCentavos: (fechamento?.guardadoRealCentavos ?? 0) + valorGuardado,
        gastoRealCentavos: d.podeGastar.gastosCentavos,
      });
      await db.config.put({ chave, valor: { ...marcados, guardar: true } });
    });
    setGuardando(false);
    toast(dist.consignadoCentavos > 0
      ? `Guardado. Antecipe ${formatarReais(dist.consignadoCentavos)} no app do banco e registre abaixo.`
      : 'Guardado nas metas');
  }

  const itens: { id: string; texto: string; valor?: number }[] = [
    ...d.cartoes.map(c => {
      const comp = mes > d.situacao.mesInicial ? mes : d.situacao.mesInicial;
      return { id: `fatura:${c.id}`, texto: `Pagar fatura ${c.nome} (vence ${formatarDiaMes(datasDaFatura(cartaoCfg(c), comp).vencimento)})` };
    }),
    ...d.parametros.fixas
      .filter(f => (f.forma === 'pix' || f.forma === 'dinheiro') && (!f.inicio || mes >= f.inicio) && (!f.fim || mes <= f.fim))
      .map(f => ({ id: `fixa:${f.id}`, texto: `Pagar ${f.nome} por ${f.forma === 'pix' ? 'Pix' : 'dinheiro'}`, valor: f.valorCentavos })),
  ];

  return (
    <section className="cartao coluna">
      <h2>Checklist de {formatarMes(mes)}</h2>
      <label className="marcador">
        <input type="checkbox" checked={!!marcados.guardar} onChange={e => (e.target.checked ? setGuardando(true) : marcar('guardar', false))} />
        <span style={{ flex: 1 }}>
          Guardar a meta no dia do salário
          {fechamento && <span className="pequeno fraco"> · guardado <Reais v={fechamento.guardadoRealCentavos} /></span>}
        </span>
        {linha && <strong><Reais v={linha.metaCentavos} /></strong>}
      </label>
      {guardando && (
        <div className="cartao coluna" style={{ background: 'var(--superficie-2)' }}>
          <CampoValor rotulo="Quanto você guardou?" valor={valorGuardado} onChange={setValorGuardado} />
          <p className="pequeno fraco">Vai para as metas na ordem do plano.</p>
          <div className="linha">
            <button className="botao secundario pequeno" onClick={() => setGuardando(false)}>Cancelar</button>
            <button className="botao pequeno" onClick={confirmarGuardado} disabled={valorGuardado === undefined}>Confirmar</button>
          </div>
        </div>
      )}
      {itens.map(i => (
        <label key={i.id} className="marcador">
          <input type="checkbox" checked={!!marcados[i.id]} onChange={e => marcar(i.id, e.target.checked)} />
          <span style={{ flex: 1 }}>{i.texto}</span>
          {i.valor !== undefined && <span className="fraco"><Reais v={i.valor} /></span>}
        </label>
      ))}
    </section>
  );
}

function Consignado() {
  const d = useDados();
  const reg = d.consignado!;
  const cfg = d.situacao.consignadoCfg;
  const estado = d.situacao.consignado;
  const mes = d.situacao.mesInicial;
  const [simValor, setSimValor] = useState<number | undefined>();
  const [registrando, setRegistrando] = useState(false);
  const [form, setForm] = useState<{ data: string; valor?: number; de?: number; ate?: number }>({ data: d.hoje });

  const sim = simValor ? antecipar(cfg, estado, mes, simValor) : null;
  const nominalEliminado = sim ? saldoNominal(cfg, estado) - saldoNominal(cfg, sim.estado) : 0;

  async function registrar() {
    if (!form.valor || !form.de || !form.ate || form.ate > form.de) return;
    const novo = { ...estado, maiorAberta: Math.min(estado.maiorAberta, form.ate - 1), nominalMaiorCentavos: cfg.parcelaCentavos };
    if (form.de < estado.maiorAberta) {
      if (!confirm(`As parcelas abertas vão até a ${estado.maiorAberta}. Registrar da ${form.de} à ${form.ate} mesmo assim?`)) return;
    }
    await db.transaction('rw', db.antecipacoes, db.consignado, async () => {
      await db.antecipacoes.add({ data: form.data, valorPagoCentavos: form.valor!, deParcela: form.de!, ateParcela: form.ate! });
      await db.consignado.update(reg.contrato, { estado: novo, estadoEm: mes });
    });
    setRegistrando(false);
    setForm({ data: d.hoje });
    toast('Antecipação registrada');
  }

  return (
    <section className="cartao coluna">
      <h2>Consignado</h2>
      {quitado(estado) ? <Aviso nivel="ok" titulo="Quitado!" /> : (
        <>
          <div className="grade-2">
            <div><span className="pequeno fraco">Parcelas abertas</span><br /><strong>{parcelasAbertas(estado)}</strong> <span className="pequeno fraco">({estado.menorAberta} a {estado.maiorAberta})</span></div>
            <div><span className="pequeno fraco">Pagas</span><br /><strong>{reg.totalParcelas - parcelasAbertas(estado)}</strong> <span className="pequeno fraco">de {reg.totalParcelas}</span></div>
            <div><span className="pequeno fraco">Saldo estimado p/ quitar</span><br /><strong><Reais v={saldoParaQuitar(cfg, estado, mes)} /></strong></div>
            <div><span className="pequeno fraco">Nominal restante</span><br /><strong><Reais v={saldoNominal(cfg, estado)} /></strong></div>
          </div>
          <p className="pequeno fraco">O valor exato é o do app do banco. Aqui é estimativa ({formatarMes(mes)}).</p>

          <h3>Simular antecipação</h3>
          <CampoValor rotulo="Quanto tem hoje para antecipar?" valor={simValor} onChange={setSimValor} />
          {sim && (
            <Aviso nivel="info" titulo={sim.quitadas ? `Elimina as parcelas ${sim.quitadas.de} a ${sim.quitadas.ate}` : 'Não quita nenhuma parcela inteira'}>
              {formatarReais(nominalEliminado)} nominais por {formatarReais(sim.pagoCentavos)}
              {sim.abatidoParcialCentavos > 0 ? ` (inclui ${formatarReais(sim.abatidoParcialCentavos)} abatidos da parcela ${sim.estado.maiorAberta})` : ''}.
              {sim.pagoCentavos < (simValor ?? 0) ? ` Sobram ${formatarReais((simValor ?? 0) - sim.pagoCentavos)}: quita tudo!` : ''}
            </Aviso>
          )}
          {!registrando ? (
            <button
              className="botao secundario cheio"
              onClick={() => { setRegistrando(true); setForm({ data: d.hoje, valor: sim?.pagoCentavos, de: sim?.quitadas?.de, ate: sim?.quitadas?.ate }); }}
            >Registrar antecipação</button>
          ) : (
            <div className="cartao coluna" style={{ background: 'var(--superficie-2)' }}>
              <p className="pequeno fraco">Confira no app do banco o valor pago e as parcelas quitadas (ex.: da 95 à 80).</p>
              <CampoTexto rotulo="Data" tipo="date" valor={form.data} onChange={v => setForm({ ...form, data: v })} />
              <CampoValor rotulo="Valor pago" valor={form.valor} onChange={v => setForm({ ...form, valor: v })} />
              <div className="grade-2">
                <CampoNumero rotulo="Da parcela" valor={form.de} onChange={v => setForm({ ...form, de: v })} />
                <CampoNumero rotulo="Até a parcela" valor={form.ate} onChange={v => setForm({ ...form, ate: v })} />
              </div>
              <div className="linha">
                <button className="botao secundario pequeno" onClick={() => setRegistrando(false)}>Cancelar</button>
                <button className="botao pequeno" onClick={registrar} disabled={!form.valor || !form.de || !form.ate || form.ate > form.de}>Salvar</button>
              </div>
            </div>
          )}
        </>
      )}
      {d.antecipacoes.length > 0 && (
        <>
          <h3>Histórico de antecipações</h3>
          <div className="lista">
            {[...d.antecipacoes].sort((a, b) => b.data.localeCompare(a.data)).map(a => (
              <div key={a.id} className="linha pequeno">
                <span>{a.data.length > 7 ? formatarData(a.data) : formatarMes(a.data)} · parcelas {a.deParcela} a {a.ateParcela}</span>
                <strong><Reais v={a.valorPagoCentavos} /></strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
