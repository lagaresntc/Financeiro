import { describe, expect, it } from 'vitest';
import { distribuirGuardado } from './guardar';
import { parametros } from './fixturesTeste';

describe('distribuir o que foi guardado', () => {
  const destinos = parametros().destinos; // reserva (alvo R$ 1.000) → consignado → sonho (alvo R$ 10.000)

  it('completa a reserva, depois o consignado, depois a próxima meta', () => {
    const r = distribuirGuardado(destinos, { reserva: 40000 }, 200000, 500000);
    expect(r.porMeta).toEqual({ reserva: 60000, sonho: 240000 });
    expect(r.consignadoCentavos).toBe(200000);
  });

  it('o que sobra de todas as metas vai para investimentos', () => {
    const r = distribuirGuardado(destinos, {}, 0, 2000000);
    expect(r.porMeta).toEqual({ reserva: 100000, sonho: 1000000, investimentos: 900000 });
  });

  it('meta sem alvo recebe todo o resto', () => {
    const r = distribuirGuardado([{ metaId: 'a', ordem: 1, alvoCentavos: 1000 }, { metaId: 'b', ordem: 2 }], {}, 0, 5000);
    expect(r.porMeta).toEqual({ a: 1000, b: 4000 });
  });
});
