import * as pdfjs from 'pdfjs-dist';
import type { ItemTexto } from './itauPdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Extrai os pedaços de texto com posição de todas as páginas (só no navegador). */
export async function extrairItensPdf(arquivo: ArrayBuffer): Promise<ItemTexto[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arquivo) }).promise;
  const itens: ItemTexto[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    for (const it of conteudo.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      itens.push({ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number, pagina: p });
    }
  }
  await doc.destroy();
  return itens;
}
