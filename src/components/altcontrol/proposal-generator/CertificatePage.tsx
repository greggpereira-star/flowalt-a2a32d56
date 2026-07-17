import React from 'react';
import { PAGE_W, PAGE_H } from './ProposalRenderer';

interface Props {
  clientName: string;
  signerName: string;
  signerDocument?: string | null;
  signerEmail?: string | null;
  signedAt: string;
  ip?: string | null;
  userAgent?: string | null;
  documentHash: string;
  signatureImage: string;
  selectedOptionTitle?: string;
}

/** Página final do PDF assinado — certificado de assinatura eletrônica com trilha de auditoria. */
export const CertificatePage = React.forwardRef<HTMLDivElement, Props>(
  ({ clientName, signerName, signerDocument, signerEmail, signedAt, ip, userAgent, documentHash, signatureImage, selectedOptionTitle }, ref) => {
    const formattedDate = new Date(signedAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    return (
      <div
        ref={ref}
        style={{
          width: PAGE_W, height: PAGE_H, background: '#fff', position: 'relative', overflow: 'hidden',
          color: '#111', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          padding: '60px 56px', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#22c55e', textTransform: 'uppercase' }}>
          ✓ Assinado eletronicamente
        </div>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 34, marginTop: 8, color: '#0d0d0d' }}>
          Certificado de Assinatura
        </div>
        <div style={{ height: 4, width: 120, background: '#22c55e', borderRadius: 2, marginTop: 12, marginBottom: 30 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14.5 }}>
          <Row label="Cliente" value={clientName} />
          {selectedOptionTitle && <Row label="Opção aprovada" value={selectedOptionTitle} />}
          <Row label="Assinado por" value={signerName} />
          {signerDocument && <Row label="CPF/CNPJ" value={signerDocument} />}
          {signerEmail && <Row label="E-mail" value={signerEmail} />}
          <Row label="Data e hora" value={formattedDate} />
          {ip && <Row label="Endereço IP" value={ip} />}
        </div>

        <div style={{ marginTop: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Assinatura
          </div>
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, background: '#fafafa', display: 'inline-block' }}>
            <img src={signatureImage} alt="Assinatura" style={{ maxWidth: 320, maxHeight: 120, display: 'block' }} />
          </div>
        </div>

        <div style={{ marginTop: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Integridade do documento
          </div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#444', wordBreak: 'break-all', lineHeight: 1.6 }}>
            SHA-256: {documentHash}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            Este hash comprova que o conteúdo da proposta não foi alterado após a assinatura.
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10.5, color: '#999', borderTop: '1px solid #eee', paddingTop: 14 }}>
          Documento assinado eletronicamente através da plataforma Flowalt (ALT Agency Partners). Este certificado
          registra a data, hora, endereço IP e identificação do signatário no momento da assinatura como evidência
          de autenticidade e aceite dos termos da proposta.
        </div>
      </div>
    );
  }
);
CertificatePage.displayName = 'CertificatePage';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ width: 140, fontWeight: 700, color: '#333' }}>{label}</div>
      <div style={{ color: '#111' }}>{value}</div>
    </div>
  );
}
