import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useDados } from '../dados';
import { Aviso, CampoTexto, CampoValor, Chips, Passo, Reais, Topo, toast } from '../componentes';
import { ir } from '../rotas';
import { CATEGORIAS, aprenderRegra, categorizar, ehPixNoCredito, type Categoria } from '../../domain/categorias';
import { competenciaDaCompra, datasDaFatura } from '../../domain/faturas';
import { formatarData, formatarMes } from '../../domain/datas';
import { formatarReais } from '../../domain/dinheiro';
import { simularCompra, valorDaParcela } from '../../domain/simulador';
import { cartaoCfg } from '../../db/situacao';

export default function Lancar() {
  const d = useDados();
  const principal = d.cartoes.find(c => c.principal) ?? d.cartoes[0];
  const [valor, setValor] = useState<number | undefined>();
  const [forma, setForma] = useState<string>(principal?.id ?? 'pix');
  const [categoria, setCategoria] = useState<Categoria | undefined>();
  const [parcelas, setParcelas] = useState(1);
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(d.hoje);
  const [salvando, setSalvando] = useState(false);

  const cartao = d.cartoes.find(c => c.id === forma);
  const n = cartao ? parcelas : 1;
  const sugerida = descricao.trim() ? categorizar(descricao, d.regrasCategoria) : undefined;
  const categoriaFinal: Categoria = categoria ?? sugerida ?? 'Outros';

  const avisos = useMemo(() => {
    const lista: { nivel: 'info' | 'atencao' | 'perigo'; titulo: string; texto?: string }[] = [];
    if (cartao && ehPixNoCredito(descricao)) {
      lista.push({ nivel: 'perigo', titulo: 'Pix no crédito', texto: 'Cobra IOF e encargos. Prefira Pix da conta.' });
    }
    if (!valor) return lista;
    if (n > 1) {
      const sim = simularCompra(d.situacao, d.parametros, { valorCentavos: valor, parcelas: n, forma, data, descricao });
      if (n > 4 || !sim.cabe) {
        lista.push({
          nivel: sim.cabe ? 'atencao' : 'perigo',
          titulo: `${n}x de ${formatarReais(sim.valorParcelaCentavos)} de ${formatarMes(sim.primeiraCompetencia)} a ${formatarMes(sim.linhas[sim.linhas.length - 1]?.mes ?? sim.primeiraCompetencia)}`,
          texto: sim.cabe
            ? 'Cabe na folga, mas parcelamento longo se empilha. De preferência, até 4x.'
            : `Come ${formatarReais(sim.comeDaMetaCentavos)} da meta em ${sim.mesesQueComemMeta} ${sim.mesesQueComemMeta === 1 ? 'mês' : 'meses'}.`,
        });
      }
    } else if (valor > d.podeGastar.valorCentavos) {
      const sai = valor - Math.max(0, d.podeGastar.valorCentavos);
      lista.push({ nivel: 'perigo', titulo: 'Estoura a folga do ciclo', texto: `Sai ${formatarReais(sai)} da meta deste mês.` });
    }
    return lista;
  }, [cartao, descricao, valor, n, forma, data, d]);

  async function salvar() {
    if (!valor || salvando) return;
    setSalvando(true);
    const grupo = n > 1 ? crypto.randomUUID() : undefined;
    await db.lancamentos.add({
      data, valorCentavos: valorDaParcela(valor, n), forma, categoria: categoriaFinal,
      descricao: descricao.trim() || categoriaFinal, parcelas: n, parcelaInicial: 1, grupoParcelaId: grupo,
      origem: 'manual', criadoEm: new Date().toISOString(),
    });
    // O app aprende: categoria trocada à mão vira regra para essa descrição.
    if (categoria && descricao.trim() && categoria !== sugerida) {
      await db.config.put({ chave: 'regrasCategoria', valor: aprenderRegra(d.regrasCategoria, descricao, categoria) });
    }
    if (cartao) {
      const cfg = cartaoCfg(cartao);
      const comp = competenciaDaCompra(cfg, data);
      toast(`Entra na fatura ${cartao.nome} de ${formatarData(datasDaFatura(cfg, comp).vencimento).slice(0, 5)}`);
    } else {
      toast(`Lançado: ${formatarReais(valor)} no ${forma === 'pix' ? 'Pix' : 'dinheiro'}`);
    }
    ir('inicio');
  }

  const formas = [
    ...d.cartoes.map(c => ({ valor: c.id, rotulo: c.nome })),
    { valor: 'pix', rotulo: 'Pix' },
    { valor: 'dinheiro', rotulo: 'Dinheiro' },
  ];

  return (
    <main className="tela">
      <Topo titulo="Lançar gasto" comVoltar />
      <CampoValor valor={valor} onChange={setValor} grande autoFocus />
      <div className="coluna">
        <span className="pequeno fraco">Forma</span>
        <Chips opcoes={formas} valor={forma} onChange={setForma} />
      </div>
      <div className="coluna">
        <span className="pequeno fraco">Categoria{!categoria && sugerida ? ` (sugerida: ${sugerida})` : ''}</span>
        <Chips opcoes={CATEGORIAS.map(c => ({ valor: c, rotulo: c }))} valor={categoriaFinal} onChange={setCategoria} />
      </div>
      {cartao && (
        <div className="linha">
          <span className="pequeno fraco">Parcelas{valor && n > 1 ? <> · <Reais v={valorDaParcela(valor, n)} /> cada</> : ''}</span>
          <Passo valor={parcelas} onChange={setParcelas} sufixo="x" />
        </div>
      )}
      <CampoTexto rotulo="Descrição (opcional)" valor={descricao} onChange={setDescricao} placeholder="Ex.: Padaria" />
      <CampoTexto rotulo="Data" tipo="date" valor={data} onChange={v => v && setData(v)} />
      {avisos.map(a => <Aviso key={a.titulo} nivel={a.nivel} titulo={a.titulo}>{a.texto}</Aviso>)}
      <button className="botao cheio" disabled={!valor || salvando} onClick={salvar}>Salvar</button>
    </main>
  );
}
