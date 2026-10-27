import { useEffect, useState } from 'react';

// Rotas por hash (#/plano/editor): funcionam offline, no GitHub Pages e com o botão voltar do celular.

export function useRota(): string[] {
  const ler = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('/').map(decodeURIComponent);
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const aoMudar = () => { setRota(ler()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  return rota;
}

export function ir(...partes: string[]) {
  location.hash = '/' + partes.map(encodeURIComponent).join('/');
}

export function href(...partes: string[]): string {
  return '#/' + partes.map(encodeURIComponent).join('/');
}

export function voltar() {
  if (history.length > 1) history.back();
  else ir('inicio');
}
