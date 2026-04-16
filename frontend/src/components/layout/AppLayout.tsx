import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { WelcomeOverlay } from '../WelcomeOverlay';
import { ChatWidget } from '../ChatWidget';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import { ToastProvider } from '../../context/ToastContext';

function Layout() {
  const { isOpen, close } = useSidebar();

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Overlay sombre sur mobile quand sidebar ouverte */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={close}
        />
      )}

      <Sidebar />

      {/* Contenu principal — décalé uniquement sur lg+ */}
      <main className="flex-1 min-h-screen flex flex-col lg:ml-60" style={{ overflowY: 'scroll' }}>
        <TopNavbar />
        <div className="flex-1 w-full px-4 sm:px-6 pt-4 pb-7">
          <Outlet />
        </div>
      </main>

      <WelcomeOverlay />
      <ChatWidget />
    </div>
  );
}

export function AppLayout() {
  return (
    <ToastProvider>
      <SidebarProvider>
        <Layout />
      </SidebarProvider>
    </ToastProvider>
  );
}
