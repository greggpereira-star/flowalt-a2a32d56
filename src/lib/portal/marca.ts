import type React from 'react';

/**
 * Cor da marca da agencia (#RRGGBB) como variaveis de tema: --primary em "H S% L%" e a cor do texto sobre ela,
 * escolhida pela luminancia para manter o contraste. Valor invalido devolve nada e a pagina usa o tema padrao.
 */
export function varsDaMarca(hex: string | null | undefined): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60 + (h < 0 ? 360 : 0));
  }
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return {
    '--primary': `${h} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`,
    '--primary-foreground': lum > 0.55 ? '0 0% 8%' : '0 0% 100%',
  } as React.CSSProperties;
}
