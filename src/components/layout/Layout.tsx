import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar, MobileNav } from './Sidebar';
import { ToastContainer } from '../ui/Toast';

export function Layout() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header />
      <Sidebar />
      <main className="md:ml-56 pt-14 pb-20 md:pb-0 min-h-screen bg-white dark:bg-slate-950">
        <Outlet />
      </main>
      <MobileNav />
      <ToastContainer />
    </div>
  );
}
