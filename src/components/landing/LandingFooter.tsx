import React from 'react';
import { useNavigate } from 'react-router-dom';

const columns = [
  {
    title: 'Produto',
    links: [
      { label: 'Aprovação', href: '#aprovacao' },
      { label: 'Portal do cliente', href: '#portal' },
      { label: 'Brand Core', href: '#brand-core' },
      { label: 'Perguntas', href: '#perguntas' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacidade', href: '/privacy' },
      { label: 'Termos', href: '/terms' },
      { label: 'Exclusão de Dados', href: '/data-deletion' },
    ],
  },
];

export const LandingFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/40 bg-muted/10">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <span className="font-display text-lg font-extrabold text-foreground">
              Flow<span className="text-primary">Alt</span>
            </span>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Aprovação de conteúdo, calendário e material de marca para agências e social medias.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => {
                        if (link.href.startsWith('/')) {
                          e.preventDefault();
                          navigate(link.href);
                        }
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FlowAlt. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
