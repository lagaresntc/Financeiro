import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useDados, nomeMeta } from '../dados';
import { Aviso, CampoTexto, CampoValor, Chips, Passo, Reais, Topo, toast } from '../componentes';
import { ir } from '../rotas';
import { simularCompra } from '../../domain/simulador';
import { quitado } from '../../domain/consignado';
import { formatarData, formatarMes } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';

export default function Simular() {
  const d = useDados();
  const principal = d.cartoes.find(c => c.principal) ?? d.cartoes[0];
  const [valor, setValor] = useState<number | undefined>();
  const [parcelas, setParcelas] = useState(1);
  const [forma, setForma] = useState(principal?.id ?? 'pix');
  const [data, setData] = useState(d.hoje);
  const [descricao, setDescricao] = useState('');
  const cartao = d.cartoes.find(c => c.id === forma);

  const sim = useMemo(
    () => (valor ? simularCompra(d.situacao, d.parametros, { valorCentavos: valor, parcelas, forma, data, descricao }) : null),
    [valor, parcelas, forma, data, descricao, d.situacao, d.parametros],
  );
  const atrasos = sim ? Object.entries(sim.atrasos).filter(([, m]) => m > 0) : [];
  const temConsignado = !!d.consignado && !quitado(d.situacao.consignado);

  async function confirmar() {
    if (!valor || !sim) return;
    await db.lancamentos.add({
      data, valorCentavos: sim.valorParcelaCentavos, forma, categoria: 'Outros', descricao: descricao.trim() || 'Compra simulada',
      parcelas: cartao ? parcelas : 1, parcelaInicial: 1, grupoParcelaId: cartao && parcelas > 1 ? crypto.randomUUID() : undefined,
      origem: 'manual', criadoEm: new Date().toISOString(),
    });
    toast('Compra lançada');
    ir('inicio');
  }

  return (
    <main className="tela">
      <Topo titulo="Simular compra" />
      <section className="cartao coluna">
        <CampoValor rotulo="Valor total" valor={valor} onChange={setValor} grande />
        <Chips opcoes={[...d.cartoes.map(c => ({ valor: c.id, rotulo: c.nome })), { valor: 'pix', rotulo: 'À vista (Pix)' }]} valor={forma} onChange={setForma} />
        {cartao && <div className="linha"><span className="pequeno fraco">Parcelas</span><Passo valor={parcelas} onChange={setParcelas} sufixo="x" /></div>}
        <div className="grade-2">
          <CampoTexto rotulo="Data da compra" tipo="date" valor={data} onChange={v => v && setData(v)} />
          <CampoTexto rotulo="O quê (opcional)" valor={descricao} onChange={setDescricao} />
        </div>
      </section>

      {sim && (
        <>
          <Aviso
            nivel={sim.cabe ? 'ok' : 'perigo'}
            titulo={sim.cabe ? 'Cabe na folga' : `Come ${formatarReais(sim.comeDaMetaCentavos)} da meta em ${sim.mesesQueComemMeta} ${sim.mesesQueComemMeta === 1 ? 'mês' : 'meses'}`}
          >
            {cartao ? `${parcelas}x de ${formatarReais(sim.valorParcelaCentavos)}, a 1ª na fatura de ${formatarMes(sim.primeiraCompetencia)}${sim.vencimentoPrimeira ? ` (vence ${formatarData(sim.vencimentoPrimeira)})` : ''}.` : 'Sai do mês da compra.'}
            {atrasos.length > 0 && ` Atrasa: ${atrasos.map(([id, m]) => `${nomeMeta(id, d.metas)} em ${m} ${m === 1 ? 'mês' : 'meses'}`).join(', ')}.`}
          </Aviso>

          {cartao && sim.melhorDia && sim.melhorDia !== data && (
            <Aviso nivel="info" titulo={`Compre a partir de ${formatarData(sim.melhorDia)}`}>
              É o melhor dia do {cartao.nome}: a 1ª parcela cai em {formatarMes(sim.primeiraCompetenciaNoMelhorDia!)}, com mais prazo.
            </Aviso>
          )}
          {cartao && parcelas > 4 && <Aviso nivel="atencao" titulo="Parcelamento longo se empilha">De preferência, só sem juros e até 4x.</Aviso>}
          {temConsignado && <Aviso nivel="info" titulo="À vista só compensa com desconto acima de ~12%">Enquanto o consignado existir, cada real livre rende mais amortizando.</Aviso>}

          <section className="cartao">
            <h2>Mês a mês</h2>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Mês</th><th>Folga antes</th><th>Parcela</th><th>Folga depois</th><th>Meta</th></tr></thead>
                <tbody>
                  {sim.linhas.map(l => (
                    <tr key={l.mes} className={l.metaDepoisCentavos < l.metaAntesCentavos ? 'marcado' : undefined}>
                      <td>{formatarMes(l.mes)}</td>
                      <td><Reais v={l.folgaAntesCentavos} /></td>
                      <td><Reais v={l.parcelaCentavos} /></td>
                      <td><Reais v={l.folgaDepoisCentavos} /></td>
                      <td>{l.metaDepoisCentavos < l.metaAntesCentavos ? <span className="vermelho"><Reais v={l.metaDepoisCentavos - l.metaAntesCentavos} /></span> : 'ok'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <button className="botao cheio" onClick={confirmar}>Confirmar compra (lançar)</button>
        </>
      )}
    </main>
  );
}
