import { describe, expect, it } from 'vitest';
import { aprenderRegra, categorizar, chaveEstabelecimento, ehPixNoCredito, normalizar, REGRAS_PADRAO } from './categorias';

describe('categorizar', () => {
  it('regras padrão', () => {
    expect(categorizar('Supermercado Exemplo', REGRAS_PADRAO)).toBe('Mercado');
    expect(categorizar('PADARIA FICTICIA', REGRAS_PADRAO)).toBe('Mercado');
    expect(categorizar('AUTO POSTO TESTE', REGRAS_PADRAO)).toBe('Gasolina');
    expect(categorizar('IFD*LOJA TESTE', REGRAS_PADRAO)).toBe('Delivery/lanche');
    expect(categorizar('MERCADOLIVRE*VENDEDOR', REGRAS_PADRAO)).toBe('Compras online');
    expect(categorizar('LOJA QUALQUER', REGRAS_PADRAO)).toBe('Outros');
  });
  it('ignora acentos', () => {
    expect(categorizar('Farmácia Fictícia', REGRAS_PADRAO)).toBe('Farmácia');
    expect(categorizar('drogaria exemplo', REGRAS_PADRAO)).toBe('Farmácia');
    expect(normalizar('  ação   já ')).toBe('ACAO JA');
  });
  it('regra do usuário vence', () => {
    const regras = aprenderRegra(REGRAS_PADRAO, 'MERCADO DO BAIRRO 02/10', 'Casa');
    expect(categorizar('Mercado do Bairro', regras)).toBe('Casa');
    expect(categorizar('SUPERMERCADO OUTRO', regras)).toBe('Mercado');
  });
});

describe('aprenderRegra', () => {
  it('chave estável sem parcela, dígitos e pontuação', () => {
    expect(chaveEstabelecimento('Loja Ficticia* Centro 123 PARCELA 2/3')).toBe('LOJA FICTICIA');
    expect(chaveEstabelecimento('LOJA FICTICIA 02/10')).toBe('LOJA FICTICIA');
  });
  it('substitui regra igual e põe na frente', () => {
    let r = aprenderRegra([], 'Café Teste', 'Casa');
    r = aprenderRegra(r, 'CAFE TESTE 01/02', 'Viagem');
    expect(r).toEqual([{ padrao: 'CAFE TESTE', categoria: 'Viagem' }]);
  });
  it('escapa caracteres de regex', () => {
    const r = aprenderRegra([], 'A+ LOJA', 'Casa');
    expect(categorizar('A LOJA', r)).toBe('Casa');
  });
});

describe('ehPixNoCredito', () => {
  it('detecta PIX como palavra', () => {
    expect(ehPixNoCredito('PIX CRED*FULANO')).toBe(true);
    expect(ehPixNoCredito('Pagamento pix')).toBe(true);
    expect(ehPixNoCredito('PIXEL STORE')).toBe(false);
  });
});
