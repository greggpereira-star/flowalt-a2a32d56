import React from 'react';
import {
  ProposalOption, ProposalTheme, ProposalBlock, TextStyle, richToHtml,
} from '@/lib/proposalDocument';

// Espectro ALT (cores amostradas do PDF original)
const GRAD = 'linear-gradient(90deg,#3ec2d4 0%,#3a6fd0 20%,#6a46c8 36%,#ebb115 55%,#f38a17 70%,#ea5a2d 84%,#e8532c 100%)';
const GRAD_V = 'linear-gradient(180deg,#3ec2d4 0%,#3a6fd0 20%,#6a46c8 36%,#ebb115 55%,#f38a17 70%,#ea5a2d 84%,#e8532c 100%)';

// A4 @ 96dpi
export const PAGE_W = 794;
export const PAGE_H = 1123;

function st(s?: TextStyle): React.CSSProperties {
  if (!s) return {};
  return {
    fontFamily: s.fontFamily ? `'${s.fontFamily}', sans-serif` : undefined,
    fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
    fontWeight: s.fontWeight,
    textAlign: s.align,
    color: s.color,
    fontStyle: s.italic ? 'italic' : undefined,
    letterSpacing: s.letterSpacing != null ? `${s.letterSpacing}px` : undefined,
  };
}

const AltLogo: React.FC = () => (
  <div style={{ position: 'absolute', right: 44, bottom: 26, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 900, fontSize: 34, lineHeight: 0.8, letterSpacing: -1, color: '#0d0d0d' }}>alt</span>
    <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.05, color: '#0d0d0d' }}>Agency.<br />Partners.</span>
  </div>
);

const Divider: React.FC<{ mt?: number; mb?: number }> = ({ mt = 14, mb = 14 }) => (
  <div style={{ height: 5, background: GRAD, borderRadius: 2, marginTop: mt, marginBottom: mb }} />
);

function Block({ block, theme }: { block: ProposalBlock; theme: ProposalTheme }) {
  const bodyFont = { fontFamily: `'${theme.bodyFont}', 'Helvetica Neue', Arial, sans-serif` };
  const gap = (block as any).gap;
  const mt = gap != null ? gap : undefined;

  switch (block.type) {
    case 'section':
      return (
        <div style={{ marginTop: mt ?? 20 }}>
          {block.title && (
            <div style={{ fontWeight: 700, fontSize: 16, ...bodyFont, ...st(block.titleStyle) }}>{block.title}</div>
          )}
          {block.body && (
            <div
              style={{ fontSize: 13.5, lineHeight: 1.5, textAlign: 'justify', color: '#1a1a1a', marginTop: 6, ...bodyFont, ...st(block.bodyStyle) }}
              dangerouslySetInnerHTML={{ __html: richToHtml(block.body) }}
            />
          )}
        </div>
      );
    case 'subsection':
      return (
        <div style={{ marginTop: mt ?? 12, marginLeft: block.indent ? 40 : 0 }}>
          {block.title && (
            <div style={{ fontWeight: 700, fontSize: 14.5, ...bodyFont, ...st(block.titleStyle) }}>{block.title}</div>
          )}
          {block.body && (
            <div
              style={{ fontSize: 13, lineHeight: 1.5, textAlign: 'justify', color: '#1a1a1a', marginTop: 4, ...bodyFont, ...st(block.bodyStyle) }}
              dangerouslySetInnerHTML={{ __html: richToHtml(block.body) }}
            />
          )}
        </div>
      );
    case 'table':
      return (
        <div style={{ marginTop: mt ?? 18, ...bodyFont }}>
          {(block.headerLeft || block.headerRight) && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 22 }}>
                <span>{block.headerLeft || 'Descrição'}</span><span>{block.headerRight || 'Qnt'}</span>
              </div>
              <Divider mt={10} mb={4} />
            </>
          )}
          {block.rows.map((r) => (
            <div key={r.id} style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                {r.desc && <div style={{ fontSize: 11, lineHeight: 1.35, color: '#333', marginTop: 3, maxWidth: 360 }}>{r.desc}</div>}
              </div>
              {r.qnt && <div style={{ fontSize: 14, whiteSpace: 'nowrap', alignSelf: 'center' }}>{r.qnt}</div>}
            </div>
          ))}
        </div>
      );
    case 'total':
      return (
        <div style={{ marginTop: mt ?? 22, ...bodyFont }}>
          <Divider mt={0} mb={14} />
          {block.mode === 'single' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 14, fontSize: 22 }}>
              <span style={{ fontWeight: 700, letterSpacing: 0.5 }}>{block.label || 'TOTAL'}</span>
              <span style={{ fontWeight: block.valueBold ? 700 : 400 }}>{block.value}</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '6px 18px', justifyContent: 'end', alignItems: 'baseline', textAlign: 'right' }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{block.setupLabel || 'SETUP/IMPLEMENTAÇÃO'}</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>{block.setupValue}</span>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{block.monthlyLabel || 'Mensalidade'}</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>{block.monthlyValue}</span>
            </div>
          )}
          <Divider mt={14} mb={0} />
        </div>
      );
    case 'terms':
      return (
        <div style={{ marginTop: mt ?? 20, ...bodyFont }}>
          <div style={{ fontWeight: 700, fontSize: 22 }}>{block.title || 'Termos & Condições'}</div>
          {block.body && (
            <div
              style={{ fontSize: 12.5, lineHeight: 1.55, textAlign: 'justify', color: '#1a1a1a', marginTop: 8 }}
              dangerouslySetInnerHTML={{ __html: richToHtml(block.body) }}
            />
          )}
        </div>
      );
    case 'spacer':
      return <div style={{ height: block.height ?? 20 }} />;
    default:
      return null;
  }
}

export interface ProposalRendererProps {
  option: ProposalOption;
  theme: ProposalTheme;
  clientName: string;
  date: string;
  /** id do container p/ exportação PDF */
  pageId?: string;
}

/** Renderiza uma página A4 (uma opção "Orçamento N"). */
export const ProposalRenderer = React.forwardRef<HTMLDivElement, ProposalRendererProps>(
  ({ option, theme, clientName, date, pageId }, ref) => {
    const titleFont = `'${theme.titleFont}', sans-serif`;
    return (
      <div
        ref={ref}
        id={pageId}
        style={{
          width: PAGE_W, height: PAGE_H, background: '#fff', position: 'relative',
          overflow: 'hidden', color: '#111',
          fontFamily: `'${theme.bodyFont}', 'Helvetica Neue', Arial, sans-serif`,
        }}
      >
        {/* Sidebar */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, background: '#0c0c0c' }}>
          <div style={{
            position: 'absolute', left: 0, right: 9, top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            fontFamily: `'${theme.sidebarFont || theme.bodyFont}', sans-serif`,
            color: '#fff', fontWeight: theme.sidebarWeight ?? 600, fontSize: theme.sidebarFontSize, letterSpacing: 0.5, whiteSpace: 'nowrap',
          }}>{theme.sidebarText}</div>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 9, background: GRAD_V }} />
        </div>

        {/* Conteúdo */}
        <div style={{ position: 'absolute', left: 120, right: 0, top: 0, bottom: 0, padding: '40px 46px 30px 40px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: titleFont, fontWeight: 800, fontSize: theme.titleFontSize ?? 74, lineHeight: 0.92, letterSpacing: -1, color: '#0d0d0d' }}>
            {option.title}
            {option.tier && <span style={{ fontFamily: titleFont, fontWeight: 500, fontSize: 26, letterSpacing: 0 }}> {option.tier}</span>}
          </div>
          <div style={{ marginTop: 16, fontSize: 19, lineHeight: 1.5 }}>
            <b>Cliente:</b> {clientName}<br /><b>Data:</b> {date}
          </div>

          {option.blocks.map((b) => <Block key={b.id} block={b} theme={theme} />)}

          <div style={{ flex: '1 1 auto' }} />
        </div>

        <AltLogo />
      </div>
    );
  }
);
ProposalRenderer.displayName = 'ProposalRenderer';
