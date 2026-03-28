import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

const ROLES: Record<string, string> = {
  system_admin: 'System Admin',
  hospital_admin: 'Hospital Admin',
  police_admin: 'Police Admin',
  fire_admin: 'Fire Admin',
  ambulance_driver: 'Ambulance Driver',
};

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
              <p className="text-[11px] text-gray-400">{ROLES[user.role] || user.role}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <UserIcon className="h-4 w-4" />
            </div>
            <button onClick={logout} className="ml-1 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
