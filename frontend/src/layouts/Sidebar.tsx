import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Truck, MapPin, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',     roles: null },
  { to: '/incidents',  icon: AlertTriangle,   label: 'Incidents',     roles: ['system_admin','hospital_admin','police_admin','fire_admin'] },
  { to: '/vehicles',   icon: Truck,           label: 'Vehicles',      roles: null },
  { to: '/tracking',   icon: MapPin,          label: 'Live Tracking', roles: null },
  { to: '/analytics',  icon: BarChart3,       label: 'Analytics',     roles: ['system_admin','hospital_admin','police_admin','fire_admin'] },
];

export default function Sidebar() {
  const { user } = useAuth();
  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-200">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-gray-900">ERP Ghana</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Dispatch Platform</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Emergency Response v1.0</p>
      </div>
    </aside>
  );
}
