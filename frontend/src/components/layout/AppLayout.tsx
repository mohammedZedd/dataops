import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen flex flex-col">
        <TopNavbar />
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-4 pb-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
