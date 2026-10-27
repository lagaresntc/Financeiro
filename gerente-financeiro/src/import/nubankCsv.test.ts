import { describe, expect, it } from 'vitest';
import { parseNubankCsv } from './nubankCsv';

describe('parseNubankCsv', () => {
  it('lê cabeçalho, aspas, parcela, ignora negativos, BOM e CRLF', () => {
    const csv = '﻿date,title,amount\r\n'
      + '2026-10-01,Loja Teste,123.45\r\n'
      + '\r\n'
      + '2026-10-02,"Restaurante, Exemplo",50\r\n'
      + '2026-10-03,Loja Fictícia - Parcela 2/3,33.33\r\n'
      + '2026-10-04,Pagamento recebido,-500.00\r\n';
    expect(parseNubankCsv(csv)).toEqual([
      { data: '2026-10-01', descricao: 'Loja Teste', valorCentavos: 12345 },
      { data: '2026-10-02', descricao: 'Restaurante, Exemplo', valorCentavos: 5000 },
      { data: '2026-10-03', descricao: 'Loja Fictícia - Parcela 2/3', valorCentavos: 3333, parcela: { k: 2, n: 3 } },
    ]);
  });
});
