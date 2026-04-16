import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SidebarCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Desktop : ouvert par défaut ; mobile : fermé par défaut
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 1024);
  const location = useLocation();

  // Ferme le menu sur mobile à chaque navigation
  useEffect(() => {
    if (window.innerWidth < 1024) setIsOpen(false);
  }, [location.pathname]);

  // Ferme automatiquement si on redimensionne vers mobile
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 1024) setIsOpen(false);
      else setIsOpen(true);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
