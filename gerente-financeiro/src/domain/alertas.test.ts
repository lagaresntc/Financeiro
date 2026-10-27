import { describe, expect, it } from 'vitest';
import { gerarAlertas, proximosEventos, type EntradaAlertas } from './alertas';
import type { CartaoCfg } from './tipos';
import { parametros } from './fixturesTeste';

const cartao: CartaoCfg = { id: 'cartao', nome: 'Cartão', diaFechamento: 5, diaVencimento: 12 };

function entrada(m: Partial<EntradaAlertas> = {}): EntradaAlertas {
  return {
    hoje: '2027-01-20', cartoes: [cartao], parametros: parametros(), podeGastarCentavos: 100000,
    gastoFaturaAbertaPorCartao: {}, saldosMetas: { reserva: 100000 }, gastoPorCategoria: {}, eventos: [], ...m,
  };
}
const ids = (e: EntradaAlertas) => gerarAlertas(e).map(a => a.id);

describe('alertas', () => {
  it('avisa quando o cartão fecha em até 3 dias', () => {
    expect(ids(entrada({ hoje: '2027-01-03' }))).toContain('fechamento:cartao');
    expect(ids(entrada({ hoje: '2027-01-20' }))).not.toContain('fechamento:cartao');
  });

  it('risco de mensalidade: nem gasto mínimo nem saldo mínimo', () => {
    const comIsencao = { ...cartao, isencao: { mensalidadeCentavos: 3900, gastoMinCentavos: 400000, saldoMinCentavos: 300000, metaIdSaldo: 'reserva' } };
    expect(ids(entrada({ cartoes: [comIsencao], saldosMetas: { reserva: 100000 } }))).toContain('mensalidade:cartao');
    expect(ids(entrada({ cartoes: [comIsencao], saldosMetas: { reserva: 300000 } }))).not.toContain('mensalidade:cartao');
    expect(ids(entrada({ cartoes: [comIsencao], gastoFaturaAbertaPorCartao: { cartao: 400000 } }))).not.toContain('mensalidade:cartao');
  });

  it('meta antes do consignado abaixo do alvo: repor primeiro', () => {
    expect(ids(entrada({ saldosMetas: { reserva: 0 } }))).toContain('repor:reserva');
    expect(ids(entrada({ saldosMetas: { reserva: 100000 } }))).not.toContain('repor:reserva');
  });

  it('categoria acima do orçamento', () => {
    expect(ids(entrada({ gastoPorCategoria: { Mercado: 160000 } }))).toContain('orcamento:Mercado');
    expect(ids(entrada({ gastoPorCategoria: { Mercado: 150000 } }))).not.toContain('orcamento:Mercado');
  });

  it('lembra de eventos com valor nos próximos 45 dias', () => {
    const eventos = [{ data: '2027-02-10', titulo: 'IPVA', valorCentavos: 90000 }, { data: '2027-06-10', titulo: 'Longe', valorCentavos: 1000 }];
    const r = ids(entrada({ eventos }));
    expect(r).toContain('evento:2027-02-10:IPVA');
    expect(r).not.toContain('evento:2027-06-10:Longe');
  });
});

describe('próximos eventos', () => {
  it('lista salário, vencimentos e eventos em ordem', () => {
    const p = parametros();
    p.rendas[0]!.dia = '5du';
    const r = proximosEventos('2027-01-03', p, [cartao], [{ data: '2027-01-20', titulo: 'Aniversário' }], 30);
    // Até 02/02: o salário e a fatura de fevereiro ficam de fora.
    expect(r.map(e => [e.data, e.tipo])).toEqual([
      ['2027-01-08', 'salario'],
      ['2027-01-12', 'vencimento'],
      ['2027-01-20', 'evento'],
    ]);
  });

  it('renda única do mês substitui o salário e os extras daquele mês', () => {
    const p = parametros();
    p.rendas[0]!.dia = '5du';
    p.rendas[1]!.regra = { tipo: 'meses', meses: [1] };
    p.rendas.push({ id: 'contracheque', nome: 'Contracheque de janeiro', valorCentavos: 800000, regra: { tipo: 'unica', mes: '2027-01', substitui: ['salario', 'abono'] }, dia: '5du' });
    const r = proximosEventos('2027-01-03', p, [], [], 20);
    expect(r.map(e => [e.data, e.titulo, e.valorCentavos])).toEqual([['2027-01-08', 'Contracheque de janeiro', 800000]]);
  });
});
