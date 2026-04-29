import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RichTextViewerProps {
  content: string | null | undefined;
  className?: string;
  fallback?: React.ReactNode;
  mentionResolver?: (id: string) => { name: string; avatar_url?: string | null } | undefined;
}

interface JSONContent {
  type: string;
  content?: JSONContent[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

/**
 * RichTextViewer - Renderiza conteúdo JSON do TipTap de forma segura
 * 
 * Características:
 * - Sanitização automática (sem dangerouslySetInnerHTML)
 * - Compatível com formato JSON do TipTap
 * - Fallback para texto simples
 * - Estilização consistente com o design system
 * - Suporte a menções com destaque visual
 */
export function RichTextViewer({ content, className, fallback, mentionResolver }: RichTextViewerProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    try {
      const parsed: JSONContent = JSON.parse(content);
      return renderNode(parsed, undefined, mentionResolver);
    } catch {
      // Se não for JSON válido, renderiza como texto simples — auto-linkificando URLs.
      return <p className="whitespace-pre-wrap break-words">{linkifyText(content)}</p>;
    }
  }, [content, mentionResolver]);

  if (!renderedContent) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <div className={cn(
      'prose prose-sm dark:prose-invert max-w-none',
      'break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0',
      '[&_p]:my-1 [&_p]:break-words [&_p]:[overflow-wrap:anywhere]',
      '[&_ul]:my-1 [&_ul]:pl-5',
      '[&_ol]:my-1 [&_ol]:pl-5',
      '[&_li]:my-0.5 [&_li]:break-words',
      // Links: visíveis, clicáveis, quebram em URLs longas e abrem em nova aba
      '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40',
      'hover:[&_a]:decoration-primary [&_a]:break-all [&_a]:cursor-pointer',
      className
    )}>
      {renderedContent}
    </div>
  );
}

// Regex para detectar URLs (http/https/www) em texto puro.
// Captura URLs comuns, evita pegar pontuação final como parte do link.
const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>()`!?,.;:'"])/gi;

/**
 * Converte texto cru em React nodes substituindo URLs por <a> clicáveis
 * que abrem em nova aba. Usado tanto para texto não-JSON quanto para
 * nodes `text` do TipTap que não tenham a marca `link`.
 */
function linkifyText(text: string): React.ReactNode {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function renderNode(
  node: JSONContent, 
  key?: number,
  mentionResolver?: (id: string) => { name: string; avatar_url?: string | null } | undefined
): React.ReactNode {
  if (!node) return null;

  // Documento raiz
  if (node.type === 'doc') {
    return (
      <>
        {node.content?.map((child, index) => renderNode(child, index, mentionResolver))}
      </>
    );
  }

  // Parágrafo
  if (node.type === 'paragraph') {
    const content = node.content?.map((child, index) => renderNode(child, index, mentionResolver));
    return <p key={key}>{content?.length ? content : <br />}</p>;
  }

  // Menção (@usuário)
  if (node.type === 'mention') {
    const mentionId = node.attrs?.id as string;
    const mentionLabel = node.attrs?.label as string;
    const resolved = mentionResolver?.(mentionId);
    const displayName = resolved?.name || mentionLabel || mentionId;

    return (
      <TooltipProvider key={key}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span 
              className="mention-chip bg-primary/15 text-primary font-medium px-1.5 py-0.5 rounded-md inline-block cursor-default hover:bg-primary/25 transition-colors"
              data-mention-id={mentionId}
            >
              @{displayName}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {resolved?.name || mentionLabel || 'Membro mencionado'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Texto com marcações
  if (node.type === 'text') {
    const rawText = node.text || '';
    const linkMark = node.marks?.find((m) => m.type === 'link');

    // Texto base: se tem marca link, mantemos o texto cru dentro do <a>;
    // caso contrário, auto-linkificamos URLs em texto puro.
    let element: React.ReactNode = linkMark ? rawText : linkifyText(rawText);

    // Aplicar marcações na ordem correta
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            element = <strong key={`bold-${key}`}>{element}</strong>;
            break;
          case 'italic':
            element = <em key={`italic-${key}`}>{element}</em>;
            break;
          case 'underline':
            element = <u key={`underline-${key}`}>{element}</u>;
            break;
          case 'strike':
            element = <s key={`strike-${key}`}>{element}</s>;
            break;
          case 'highlight':
            element = (
              <mark
                key={`highlight-${key}`}
                className="bg-warning/30 rounded px-0.5"
              >
                {element}
              </mark>
            );
            break;
          case 'link': {
            const href = (mark.attrs?.href as string) || '#';
            element = (
              <a
                key={`link-${key}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={(e) => e.stopPropagation()}
              >
                {element}
              </a>
            );
            break;
          }
        }
      }
    }

    return <span key={key}>{element}</span>;
  }

  // Lista com marcadores
  if (node.type === 'bulletList') {
    return (
      <ul key={key} className="list-disc">
        {node.content?.map((child, index) => renderNode(child, index, mentionResolver))}
      </ul>
    );
  }

  // Lista numerada
  if (node.type === 'orderedList') {
    return (
      <ol key={key} className="list-decimal">
        {node.content?.map((child, index) => renderNode(child, index, mentionResolver))}
      </ol>
    );
  }

  // Item de lista
  if (node.type === 'listItem') {
    return (
      <li key={key}>
        {node.content?.map((child, index) => renderNode(child, index, mentionResolver))}
      </li>
    );
  }

  // Hard break (shift+enter)
  if (node.type === 'hardBreak') {
    return <br key={key} />;
  }

  // Tipo desconhecido - renderiza conteúdo filho se houver
  if (node.content) {
    return (
      <div key={key}>
        {node.content.map((child, index) => renderNode(child, index, mentionResolver))}
      </div>
    );
  }

  return null;
}

/**
 * Utilitário para extrair texto puro do conteúdo JSON
 * Útil para previews, buscas, etc.
 */
export function extractPlainText(content: string | null | undefined): string {
  if (!content) return '';

  try {
    const parsed: JSONContent = JSON.parse(content);
    return extractTextFromNode(parsed);
  } catch {
    // Se não for JSON válido, retorna o próprio conteúdo
    return content;
  }
}

function extractTextFromNode(node: JSONContent): string {
  if (!node) return '';

  if (node.type === 'text') {
    return node.text || '';
  }

  // Para menções, retorna o label ou id
  if (node.type === 'mention') {
    return `@${node.attrs?.label || node.attrs?.id || ''}`;
  }

  if (node.content) {
    return node.content.map(extractTextFromNode).join('');
  }

  return '';
}

/**
 * Verifica se o conteúdo está vazio
 */
export function isRichTextEmpty(content: string | null | undefined): boolean {
  if (!content) return true;

  try {
    const parsed: JSONContent = JSON.parse(content);
    return isNodeEmpty(parsed);
  } catch {
    return !content.trim();
  }
}

function isNodeEmpty(node: JSONContent): boolean {
  if (!node) return true;

  if (node.type === 'text' && node.text?.trim()) {
    return false;
  }

  // Menções não são consideradas vazias
  if (node.type === 'mention') {
    return false;
  }

  if (node.content) {
    return node.content.every(isNodeEmpty);
  }

  return true;
}

/**
 * Extrai IDs de menções do conteúdo
 */
export function extractMentionIds(content: string | null | undefined): string[] {
  if (!content) return [];

  try {
    const parsed: JSONContent = JSON.parse(content);
    return extractMentionsFromNode(parsed);
  } catch {
    return [];
  }
}

function extractMentionsFromNode(node: JSONContent): string[] {
  if (!node) return [];

  if (node.type === 'mention' && node.attrs?.id) {
    return [node.attrs.id as string];
  }

  if (node.content) {
    return node.content.flatMap(extractMentionsFromNode);
  }

  return [];
}

export default RichTextViewer;
