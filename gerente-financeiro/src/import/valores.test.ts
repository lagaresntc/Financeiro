import { describe, expect, it } from 'vitest';
import { parseParcela, parseValorBR } from './valores';

describe('parseValorBR', () => {
  it.each([
    ['1.234,56', 123456], ['- 12,34', -1234], ['-12,34', -1234], ['R$ 1.234,56', 123456],
    ['1234.56', 123456], ['0,10', 10], ['12.5', 1250], ['-123.45', -12345], ['1.234.567,89', 123456789],
  ])('%s', (t, v) => expect(parseValorBR(t)).toBe(v));
  it('inválido = NaN', () => expect(parseValorBR('abc')).toBeNaN());
});

describe('parseParcela', () => {
  it('formatos', () => {
    expect(parseParcela('02/10')).toEqual({ k: 2, n: 10 });
    expect(parseParcela('LOJA PARCELA 2/3')).toEqual({ k: 2, n: 3 });
    expect(parseParcela('Parcela 2/3')).toEqual({ k: 2, n: 3 });
    expect(parseParcela('LOJA')).toBeUndefined();
    expect(parseParcela('15/12/2026')).toBeUndefined();
  });
});
