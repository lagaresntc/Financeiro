import { describe, expect, it } from 'vitest';
import { ehDiaUtil, feriados, pascoa, quintoDiaUtil } from './diasUteis';

describe('Páscoa e feriados móveis', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
    expect(pascoa(2028)).toBe('2028-04-16');
  });

  it('inclui Carnaval, Sexta-feira Santa e Corpus Christi', () => {
    const f = feriados(2027);
    expect(f.has('2027-02-08')).toBe(true); // segunda de Carnaval
    expect(f.has('2027-02-09')).toBe(true); // terça de Carnaval
    expect(f.has('2027-03-26')).toBe(true); // Sexta-feira Santa
    expect(f.has('2027-05-27')).toBe(true); // Corpus Christi
  });

  it('inclui os feriados fixos, inclusive Consciência Negra', () => {
    const f = feriados(2026);
    for (const d of ['2026-01-01', '2026-04-21', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25']) {
      expect(f.has(d)).toBe(true);
    }
  });
});

describe('dia útil', () => {
  it('fim de semana e feriado não são úteis', () => {
    expect(ehDiaUtil('2026-11-07')).toBe(false); // sábado
    expect(ehDiaUtil('2026-11-02')).toBe(false); // Finados, segunda
    expect(ehDiaUtil('2026-11-03')).toBe(true);
  });
});

describe('5º dia útil', () => {
  it.each([
    [2026, 11, '2026-11-09'], // Finados na segunda empurra para o dia 9
    [2026, 12, '2026-12-07'],
    [2027, 1, '2027-01-08'], // 1º de janeiro na sexta
    [2027, 2, '2027-02-05'],
    [2027, 3, '2027-03-05'],
    [2027, 5, '2027-05-07'], // 1º de maio no sábado
  ])('%i/%i → %s', (ano, mes, esperado) => {
    expect(quintoDiaUtil(ano, mes)).toBe(esperado);
  });

  it('feriado ou Carnaval no começo do mês empurra além do dia 9', () => {
    expect(quintoDiaUtil(2029, 9)).toBe('2029-09-10'); // 7 de setembro na sexta
    expect(quintoDiaUtil(2030, 3)).toBe('2030-03-11'); // Carnaval em 4 e 5/03
  });

  it('cai entre o dia 5 e o dia 9 em 2026–2028', () => {
    for (let ano = 2026; ano <= 2028; ano++) {
      for (let mes = 1; mes <= 12; mes++) {
        const dia = Number(quintoDiaUtil(ano, mes).slice(8));
        expect(dia).toBeGreaterThanOrEqual(5);
        expect(dia).toBeLessThanOrEqual(9);
      }
    }
  });
});
