import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface RichTextViewerProps {
  content: string | null | undefined;
  className?: string;
  fallback?: React.ReactNode;
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
 */
export function RichTextViewer({ content, className, fallback }: RichTextViewerProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    try {
      const parsed: JSONContent = JSON.parse(content);
      return renderNode(parsed);
    } catch {
      // Se não for JSON válido, renderiza como texto simples
      return <p className="whitespace-pre-wrap">{content}</p>;
    }
  }, [content]);

  if (!renderedContent) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <div className={cn(
      'prose prose-sm dark:prose-invert max-w-none',
      '[&_p]:my-1',
      '[&_ul]:my-1 [&_ul]:pl-5',
      '[&_ol]:my-1 [&_ol]:pl-5',
      '[&_li]:my-0.5',
      className
    )}>
      {renderedContent}
    </div>
  );
}

function renderNode(node: JSONContent, key?: number): React.ReactNode {
  if (!node) return null;

  // Documento raiz
  if (node.type === 'doc') {
    return (
      <>
        {node.content?.map((child, index) => renderNode(child, index))}
      </>
    );
  }

  // Parágrafo
  if (node.type === 'paragraph') {
    const content = node.content?.map((child, index) => renderNode(child, index));
    return <p key={key}>{content?.length ? content : <br />}</p>;
  }

  // Texto com marcações
  if (node.type === 'text') {
    let element: React.ReactNode = node.text || '';

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
        }
      }
    }

    return <span key={key}>{element}</span>;
  }

  // Lista com marcadores
  if (node.type === 'bulletList') {
    return (
      <ul key={key} className="list-disc">
        {node.content?.map((child, index) => renderNode(child, index))}
      </ul>
    );
  }

  // Lista numerada
  if (node.type === 'orderedList') {
    return (
      <ol key={key} className="list-decimal">
        {node.content?.map((child, index) => renderNode(child, index))}
      </ol>
    );
  }

  // Item de lista
  if (node.type === 'listItem') {
    return (
      <li key={key}>
        {node.content?.map((child, index) => renderNode(child, index))}
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
        {node.content.map((child, index) => renderNode(child, index))}
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

  if (node.content) {
    return node.content.every(isNodeEmpty);
  }

  return true;
}

export default RichTextViewer;
