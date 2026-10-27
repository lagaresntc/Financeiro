import { describe, expect, it } from 'vitest';
import { calcularPodeGastar, cicloDoDia } from './ciclo';
import { projetar } from './projecao';
import { parametros, situacao } from './fixturesTeste';

describe('ciclo do salário (5º dia útil até o próximo)', () => {
  it('depois do salário: ciclo deste mês', () => {
    expect(cicloDoDia('2026-11-20')).toEqual({ inicio: '2026-11-09', fim: '2026-12-07', mes: '2026-11' });
  });

  it('no dia do salário o ciclo já é o novo', () => {
    expect(cicloDoDia('2026-11-09').mes).toBe('2026-11');
  });

  it('antes do salário: ainda é o ciclo do mês anterior', () => {
    expect(cicloDoDia('2026-11-03')).toEqual({ inicio: '2026-10-07', fim: '2026-11-09', mes: '2026-10' });
  });
});

describe('pode gastar', () => {
  // Fixture: o gasto do ciclo de jan é pago nas faturas de fev.
  // Fev: variável R$ 1.500 + folga R$ 1.400 − margem R$ 500 = R$ 2.400 de envelope.
  const proj = projetar(situacao(), parametros(), { horizonteMeses: 6 });
  const ciclo = cicloDoDia('2027-01-20');

  it('envelope vem da linha do mês seguinte; desconta os gastos do ciclo', () => {
    const pg = calcularPodeGastar(proj, ciclo, '2027-01-20', 40000, 50000);
    expect(pg.envelopeCentavos).toBe(240000);
    expect(pg.valorCentavos).toBe(200000);
    expect(pg.diasRestantes).toBe(16); // até 05/02/2027
    expect(pg.porDiaCentavos).toBe(12500);
  });

  it('pode ficar negativo, sem valor por dia', () => {
    const pg = calcularPodeGastar(proj, ciclo, '2027-01-20', 300000, 50000);
    expect(pg.valorCentavos).toBe(-60000);
    expect(pg.porDiaCentavos).toBe(0);
  });

  it('progresso do ciclo vai de 0 a 1', () => {
    expect(calcularPodeGastar(proj, ciclo, ciclo.inicio, 0, 50000).progressoCiclo).toBe(0);
    const meio = calcularPodeGastar(proj, ciclo, '2027-01-22', 0, 50000).progressoCiclo;
    expect(meio).toBeCloseTo(14 / 28);
  });
});
