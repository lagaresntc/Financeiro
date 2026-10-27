import { describe, expect, it } from 'vitest';
import { type ItemTexto, montarLinhas, parseItauItens } from './itauPdf';

// monta itens de uma linha: [texto, x] na altura y
function linha(pagina: number, y: number, ...partes: [string, number][]): ItemTexto[] {
  return partes.map(([str, x]) => ({ str, x, y, pagina }));
}

// página 1: coluna esquerda x 30–250, direita x 320–560 (meio ≈ 280)
const itens: ItemTexto[] = [
  ...linha(1, 800, ['Vencimento: 10/01/2027', 30], ['Total: R$ 999,99', 500]),
  ...linha(1, 760, ['Lançamentos: compras e saques', 30]),
  ...linha(1, 740, ['15/12', 30], ['LOJA FICTICIA', 70], ['200,00', 230]),
  ...linha(1, 730, ['vestuário', 70], ['CIDADE TESTE', 140]),
  ...linha(1, 720, ['20/12', 30], ['ELETRO EXEMPLO', 70], ['03/10', 180], ['1.234,56', 220]),
  ...linha(1, 700, ['02/01', 30], ['ESTORNO LOJA', 70], ['- 50,00', 230]),
  // coluna direita (lida depois da esquerda)
  ...linha(1, 760, ['Lançamentos internacionais', 320]),
  ...linha(1, 740, ['28/12', 320], ['SITE EXTERIOR', 360], ['80,00', 530]),
  ...linha(1, 700, ['Compras parceladas - próximas faturas', 320]),
  ...linha(1, 680, ['15/02', 320], ['ELETRO EXEMPLO', 360], ['04/10', 470], ['1.234,56', 520]),
  ...linha(1, 640, ['Lançamentos: produtos e serviços', 320]),
  ...linha(1, 620, ['05/01', 320], ['ANUIDADE TESTE', 360], ['10,00', 530]),
];

describe('montarLinhas', () => {
  it('coluna esquerda inteira antes da direita', () => {
    const l = montarLinhas(itens);
    expect(l[2]).toBe('15/12 LOJA FICTICIA 200,00');
    expect(l.indexOf('Lançamentos internacionais')).toBeGreaterThan(l.indexOf('02/01 ESTORNO LOJA - 50,00'));
  });
});

describe('parseItauItens', () => {
  it('lê seções, parcela, estorno, internacional, ignora próximas faturas e vira o ano', () => {
    expect(parseItauItens(itens)).toEqual([
      { data: '2026-12-15', descricao: 'LOJA FICTICIA', valorCentavos: 20000 },
      { data: '2026-12-20', descricao: 'ELETRO EXEMPLO', valorCentavos: 123456, parcela: { k: 3, n: 10 } },
      { data: '2027-01-02', descricao: 'ESTORNO LOJA', valorCentavos: -5000 },
      { data: '2026-12-28', descricao: 'SITE EXTERIOR', valorCentavos: 8000, internacional: true },
      { data: '2027-01-05', descricao: 'ANUIDADE TESTE', valorCentavos: 1000 },
    ]);
  });
  it('aceita meioX explícito', () => {
    expect(parseItauItens(itens, 300)).toHaveLength(5);
  });
});
