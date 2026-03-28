import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-56">
        <Topbar />
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
}
