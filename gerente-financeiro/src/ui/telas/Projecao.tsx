import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useDados, nomeMeta } from '../dados';
import { Aviso, CampoValor, Reais, Topo, toast } from '../componentes';
import { href } from '../rotas';
import { GraficoProjecao } from '../GraficoProjecao';
import { DatasPrevistas, TabelaProjecao, seriesDoPlano } from '../planoComum';
import { ID_CONSIGNADO, ID_INVESTIMENTOS, projetar } from '../../domain/projecao';
import { quitado, saldoParaQuitar } from '../../domain/consignado';
import { distribuirGuardado } from '../../domain/guardar';
import { formatarDiaMes, formatarMes, mesDe } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';
import { datasDaFatura } from '../../domain/faturas';
import { cartaoCfg } from '../../db/situacao';

/** Visão geral do plano: datas, real × plano, checklist do mês e projeção mês a mês. */
export default function Projecao() {
  const d = useDados();
  const temConsignado = !!d.consignado && !quitado(d.situacao.consignado);
  const series = seriesDoPlano(d.parametros, d.metas, temConsignado);
  const ultimaData = Object.values(d.projecao.datas).sort().pop();

  return (
    <main className="tela">
      <Topo titulo="Projeção e checklist" comVoltar />
      <section className="cartao coluna">
        <div className="linha">
          <h2 style={{ margin: 0 }}>{d.cenario.nome}</h2>
          <span className="pequeno"><a href={href('plano', 'cenarios')}>Cenários</a></span>
        </div>
        <DatasPrevistas projecao={d.projecao} series={series} />
        <a className="botao secundario cheio" href={href('plano', 'editor')}>Editar o plano / e se…?</a>
      </section>

      <RealVersusPlano />
      <Checklist />

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
      ? `Guardado. Antecipe ${formatarReais(dist.consignadoCentavos)} no app do banco e registre na aba Consignado.`
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

