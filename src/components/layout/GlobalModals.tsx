import { TransactionForm } from "@/components/financial/TransactionForm";
import { InvoiceForm } from "@/components/financial/InvoiceForm";
import { useGlobalModal } from "@/contexts/GlobalModalContext";

export function GlobalModals() {
  const { activeModal, closeModal } = useGlobalModal();

  return (
    <>
      <TransactionForm 
        open={activeModal === 'transaction'} 
        onOpenChange={(open) => !open && closeModal()} 
        showTrigger={false}
      />
      <InvoiceForm 
        open={activeModal === 'invoice'} 
        onOpenChange={(open) => !open && closeModal()} 
        showTrigger={false}
      />
    </>
  );
}
