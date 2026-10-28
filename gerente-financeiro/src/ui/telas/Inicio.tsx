import { useDados, nomeMeta } from '../dados';
import { Aviso, Barra, Reais } from '../componentes';
import { href } from '../rotas';
import { formatarDiaMes, formatarMes, diasEntre } from '../../domain/datas';
import { datasDaFatura } from '../../domain/faturas';
import { proximosEventos } from '../../domain/alertas';
import { ID_CONSIGNADO } from '../../domain/projecao';
import { parcelasAbertas, quitado, saldoParaQuitar } from '../../domain/consignado';
import { cartaoCfg, faturaAbertaHoje, totalDaFatura } from '../../db/situacao';
import { calcularTetos, temRenda } from '../tetos';

export default function Inicio() {
  const d = useDados();
  const pg = d.podeGastar;
  const negativo = pg.valorCentavos < 0;

  const eventos = proximosEventos(
    d.hoje, d.parametros, d.cartoes.map(cartaoCfg),
    [...d.eventos, ...d.parametros.eventos.map(e => ({ data: e.data, titulo: e.descricao, valorCentavos: e.valorCentavos }))],
  ).slice(0, 6);

  const temConsignado = !!d.consignado && !quitado(d.situacao.consignado);
  const tetos = temRenda(d) ? calcularTetos(d) : new Map();
  const metasComAlvo = d.parametros.destinos
    .filter(x => x.metaId !== ID_CONSIGNADO && (x.alvoCentavos ?? 0) > 0)
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <main className="tela">
      <section className={`cartao ${negativo ? '' : 'destaque'} coluna`}>
        <span className="rotulo">Pode gastar até o salário de {formatarDiaMes(d.ciclo.fim)}</span>
        <span className={`numero-grande ${negativo ? 'vermelho' : ''}`}><Reais v={pg.valorCentavos} /></span>
        <Barra fracao={pg.progressoCiclo} />
        <div className="linha pequeno">
          <span>{pg.valorCentavos > 0 ? <>≈ <Reais v={pg.porDiaCentavos} />/dia por {pg.diasRestantes} dias</> : 'Segure os gastos até o salário'}</span>
          <span>Gasto no ciclo: <Reais v={pg.gastosCentavos} /></span>
        </div>
      </section>

      {d.alertas.map(a => <Aviso key={a.id} nivel={a.nivel} titulo={a.titulo}>{a.texto}</Aviso>)}

      <section className="cartao">
        <div className="linha"><h2>Faturas abertas</h2><a className="pequeno" href={href('cartoes')}>Ver todas</a></div>
        {d.cartoes.length === 0 ? (
          <p className="vazio">Nenhum cartão. <a href={href('ajustes', 'cartao', 'novo')}>Cadastrar cartão</a></p>
        ) : (
          <div className="lista">
            {d.cartoes.map(c => {
              const cfg = cartaoCfg(c);
              const comp = faturaAbertaHoje(cfg, d.hoje);
              const fatura = d.faturas.find(f => f.cartaoId === c.id && f.competencia === comp);
              const { fechamento, vencimento } = datasDaFatura(cfg, comp);
              const dias = diasEntre(d.hoje, fechamento);
              return (
                <a key={c.id} href={href('cartoes', c.id, comp)} className="linha" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="coluna" style={{ gap: 2 }}>
                    <strong>{c.nome}</strong>
                    <span className={`pequeno ${dias <= 3 ? 'amarelo' : 'fraco'}`}>
                      Fecha {formatarDiaMes(fechamento)}{dias <= 3 ? ` (${dias === 0 ? 'hoje' : `em ${dias}d`})` : ''} · vence {formatarDiaMes(vencimento)}
                    </span>
                  </div>
                  <div className="coluna" style={{ gap: 2, alignItems: 'flex-end' }}>
                    <strong><Reais v={totalDaFatura(cfg, comp, d.lancamentos, fatura)} /></strong>
                    {tetos.get(`${c.id}|${comp}`) && (
                      <span className={`pequeno ${tetos.get(`${c.id}|${comp}`)!.restaCentavos < 0 ? 'vermelho' : 'fraco'}`}>
                        máx <Reais v={Math.max(0, tetos.get(`${c.id}|${comp}`)!.tetoCentavos)} />
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section className="cartao">
        <div className="linha"><h2>Metas</h2><a className="pequeno" href={href('plano')}>Plano</a></div>
        <div className="lista">
          {temConsignado && d.consignado && (
            <div className="coluna">
              <div className="linha">
                <strong>{nomeMeta(ID_CONSIGNADO, d.metas)}</strong>
                <span className="pequeno fraco">quitado em {d.projecao.datas[ID_CONSIGNADO] ? formatarMes(d.projecao.datas[ID_CONSIGNADO]) : '—'}</span>
              </div>
              <Barra fracao={1 - parcelasAbertas(d.situacao.consignado) / d.consignado.totalParcelas} />
              <span className="pequeno fraco">
                {parcelasAbertas(d.situacao.consignado)} parcelas abertas · saldo estimado <Reais v={saldoParaQuitar(d.situacao.consignadoCfg, d.situacao.consignado, d.situacao.mesInicial)} />
              </span>
            </div>
          )}
          {metasComAlvo.map(x => {
            const saldo = d.situacao.saldosMetas[x.metaId] ?? 0;
            const data = d.projecao.datas[x.metaId];
            return (
              <div key={x.metaId} className="coluna">
                <div className="linha">
                  <strong>{nomeMeta(x.metaId, d.metas)}</strong>
                  <span className="pequeno fraco">{data ? `pronta em ${formatarMes(data)}` : 'fora do horizonte'}</span>
                </div>
                <Barra fracao={saldo / x.alvoCentavos!} />
                <span className="pequeno fraco"><Reais v={saldo} /> de <Reais v={x.alvoCentavos!} /></span>
              </div>
            );
          })}
          {!temConsignado && metasComAlvo.length === 0 && (
            <p className="vazio">Defina suas metas no <a href={href('plano', 'editor')}>editor do plano</a>.</p>
          )}
        </div>
      </section>

      <section className="cartao">
        <h2>Próximos eventos</h2>
        {eventos.length === 0 ? <p className="vazio">Nada nos próximos 45 dias.</p> : (
          <div className="lista">
            {eventos.map(e => (
              <div key={`${e.data}${e.titulo}`} className="linha">
                <span><span className="fraco num">{formatarDiaMes(e.data)}</span> · {e.titulo}</span>
                {e.valorCentavos !== undefined && <span className={e.tipo === 'salario' || e.tipo === 'renda' ? 'verde' : ''}><Reais v={e.valorCentavos} /></span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
