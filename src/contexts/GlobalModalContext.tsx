import React, { createContext, useContext, useState, useEffect } from 'react';

type ModalType = 'transaction' | 'invoice' | null;

interface GlobalModalContextType {
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  activeModal: ModalType;
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined);

export const GlobalModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(() => {
    // Persist modal state in localStorage
    const saved = localStorage.getItem('active-global-modal');
    return (saved as ModalType) || null;
  });

  const openModal = (type: ModalType) => {
    setActiveModal(type);
    if (type) {
      localStorage.setItem('active-global-modal', type);
    } else {
      localStorage.removeItem('active-global-modal');
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    localStorage.removeItem('active-global-modal');
  };

  // Sync with other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'active-global-modal') {
        setActiveModal(e.newValue as ModalType);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <GlobalModalContext.Provider value={{ openModal, closeModal, activeModal }}>
      {children}
    </GlobalModalContext.Provider>
  );
};

export const useGlobalModal = () => {
  const context = useContext(GlobalModalContext);
  if (!context) {
    throw new Error('useGlobalModal must be used within a GlobalModalProvider');
  }
  return context;
};
