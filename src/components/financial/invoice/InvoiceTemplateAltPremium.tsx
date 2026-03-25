import React from "react";

export interface InvoiceData {
  documentTitle: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  descriptionLines: string[];
  amountLabel: string;
  totalLabel: string;
  totalValue: string;
  bankTitle: string;
  bankDetails: { label: string; value: string }[];
  termsTitle: string;
  termsText: string;
  sidebarText: string;
  brandMain: string;
  brandSubTop: string;
  brandSubBottom: string;
  logoUrl?: string | null;
  currency?: string;
}

interface Props {
  data: InvoiceData;
  scale?: number;
}

export const InvoiceTemplateAltPremium = React.forwardRef<HTMLDivElement, Props>(
  ({ data, scale = 1 }, ref) => {
    return (
      <div
        ref={ref}
        className="invoice-premium-shell"
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        <style>{invoiceCSS}</style>
        <div className="invoice-premium-page">
          {/* Sidebar */}
          <div className="invoice-premium-sidebar">
            <div className="invoice-premium-sidebar__text">{data.sidebarText}</div>
            <div className="invoice-premium-sidebar__gradient" />
          </div>

          {/* Content */}
          <div className="invoice-premium-content">
            <h1 className="invoice-premium-title">{data.documentTitle}</h1>

            <div className="invoice-premium-client">
              <strong>Client:</strong> {data.clientName}
              <br />
              <strong>Date:</strong> {data.issueDate}
              <br />
              <strong>Due Date:</strong> {data.dueDate}
            </div>

            {/* Table Header */}
            <div className="invoice-premium-table__header">
              <div>Description</div>
              <div>Amount</div>
            </div>
            <div className="invoice-premium-rule" />

            {/* Items */}
            <div className="invoice-premium-table__row">
              <div className="invoice-premium-table__description">
                {data.descriptionLines.join("\n")}
              </div>
              <div className="invoice-premium-table__amount">{data.amountLabel}</div>
            </div>

            {/* Total */}
            <div className="invoice-premium-total">
              <div className="invoice-premium-rule" />
              <div className="invoice-premium-total__row">
                <span className="invoice-premium-total__label">{data.totalLabel}</span>
                <span>{data.totalValue}</span>
              </div>
              <div className="invoice-premium-rule" />
            </div>

            {/* Footer */}
            <div className="invoice-premium-footer">
              <h3 className="invoice-premium-footer__title">{data.bankTitle}</h3>
              <p className="invoice-premium-footer__body">
                {data.bankDetails.map((d, i) => (
                  <React.Fragment key={i}>
                    <strong>{d.label}:</strong> {d.value}
                    {i < data.bankDetails.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
              {data.termsText && (
                <>
                  <h3 className="invoice-premium-footer__title">{data.termsTitle}</h3>
                  <p className="invoice-premium-footer__body">{data.termsText}</p>
                </>
              )}
            </div>

            {/* Brand */}
            <div className="invoice-premium-brand">
              {data.logoUrl ? (
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain" }}
                />
              ) : (
                <>
                  <div className="invoice-premium-brand__main">{data.brandMain}</div>
                  <div className="invoice-premium-brand__sub">
                    <div>{data.brandSubTop}</div>
                    <div className="invoice-premium-brand__dotline">
                      <span className="invoice-premium-brand__dot" />
                      {data.brandSubBottom}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

InvoiceTemplateAltPremium.displayName = "InvoiceTemplateAltPremium";

const invoiceCSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

.invoice-premium-shell {
  display: flex;
  justify-content: center;
}

.invoice-premium-page {
  width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  display: flex;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  font-family: 'Inter', Arial, sans-serif;
  color: #111111;
}

.invoice-premium-sidebar {
  width: 14%;
  background: #111111;
  position: relative;
  display: flex;
  align-items: center;
}

.invoice-premium-sidebar__gradient {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, #3b82f6, #ef4444, #f59e0b, #ffffff);
}

.invoice-premium-sidebar__text {
  color: #ffffff;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  white-space: nowrap;
  margin-left: auto;
  margin-right: 25px;
  margin-bottom: -150px;
}

.invoice-premium-content {
  width: 86%;
  padding: 60px 70px;
  display: flex;
  flex-direction: column;
}

.invoice-premium-title {
  font-size: 4.5rem;
  font-weight: 900;
  letter-spacing: -3px;
  line-height: 1;
  margin: 0 0 40px;
  color: #111111;
}

.invoice-premium-client {
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 60px;
  color: #111111;
}

.invoice-premium-client strong {
  font-weight: 700;
}

.invoice-premium-table__header {
  display: flex;
  justify-content: space-between;
  font-size: 1.1rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 10px;
}

.invoice-premium-rule {
  height: 2px;
  background: linear-gradient(to right, #3b82f6, #ef4444, #f59e0b, #ffffff);
  margin-bottom: 25px;
}

.invoice-premium-table__row {
  display: flex;
  justify-content: space-between;
  font-size: 1.05rem;
  line-height: 1.4;
  font-weight: 700;
  color: #111111;
  margin-bottom: 50px;
  gap: 20px;
  align-items: flex-start;
}

.invoice-premium-table__description {
  white-space: pre-line;
}

.invoice-premium-table__amount {
  font-weight: 600;
  color: #555555;
  text-align: right;
  min-width: 170px;
}

.invoice-premium-total {
  margin-top: 30px;
}

.invoice-premium-total .invoice-premium-rule:first-child,
.invoice-premium-total .invoice-premium-rule:last-child {
  margin-bottom: 0;
}

.invoice-premium-total__row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: 1.2rem;
  font-weight: 700;
  color: #111111;
  padding: 15px 0;
}

.invoice-premium-total__label {
  margin-right: 30px;
}

.invoice-premium-footer {
  margin-top: 60px;
}

.invoice-premium-footer__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #111111;
  margin: 0 0 15px;
}

.invoice-premium-footer__body {
  font-size: 0.95rem;
  line-height: 1.5;
  color: #555555;
  margin: 0 0 30px;
}

.invoice-premium-footer__body strong {
  font-weight: 700;
  color: #666666;
}

.invoice-premium-brand {
  margin-top: auto;
  display: flex;
  align-items: flex-end;
}

.invoice-premium-brand__main {
  font-size: 4rem;
  font-weight: 900;
  letter-spacing: -3px;
  line-height: 0.75;
  color: #111111;
}

.invoice-premium-brand__sub {
  margin-left: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
  color: #111111;
  padding-bottom: 3px;
}

.invoice-premium-brand__dotline {
  display: flex;
  align-items: center;
}

.invoice-premium-brand__dot {
  width: 4px;
  height: 4px;
  background: #555555;
  border-radius: 50%;
  margin-right: 4px;
  display: inline-block;
}
`;
