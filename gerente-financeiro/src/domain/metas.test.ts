import { describe, expect, it } from 'vitest';
import { aporteMensalParaMeta, fracaoConcluida, taxaMensalDoCdi } from './metas';

describe('metas', () => {
  it('fração concluída', () => {
    expect(fracaoConcluida(25000, 100000)).toBe(0.25);
    expect(fracaoConcluida(0, undefined)).toBe(0);
    expect(fracaoConcluida(150000, 100000)).toBe(1.5);
  });

  it('sem rendimento: o que falta dividido pelos meses (para cima)', () => {
    expect(aporteMensalParaMeta(1000000, 100000, 9)).toBe(100000);
    expect(aporteMensalParaMeta(1000, 0, 3)).toBe(334);
  });

  it('já cumprida ou prazo vencido', () => {
    expect(aporteMensalParaMeta(1000, 2000, 5, 0.01)).toBe(0);
    expect(aporteMensalParaMeta(1000, 400, 0)).toBe(600);
  });

  it('com rendimento, guarda menos e o valor futuro bate', () => {
    const r = 0.01;
    const p = aporteMensalParaMeta(1200000, 100000, 12, r);
    expect(p).toBeLessThan(Math.ceil((1200000 - 100000) / 12));
    const fv = 100000 * (1 + r) ** 12 + (p * ((1 + r) ** 12 - 1)) / r;
    expect(fv).toBeGreaterThanOrEqual(1200000);
    expect(fv - 1200000).toBeLessThan(20);
  });

  it('taxa mensal do CDI', () => {
    expect(taxaMensalDoCdi(0.12, 1)).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1);
  });
});
