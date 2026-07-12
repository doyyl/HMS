import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { CustomerOrder } from '../lib/types';

const NAV = [
  { to: '/', label: 'ผังห้องพัก', icon: '▦', end: true },
  { to: '/orders', label: 'คำสั่งซื้อจากลูกค้า', icon: '🔔', badge: true },
  { to: '/pos', label: 'ขายสินค้า', icon: '🛒' },
  { to: '/cash', label: 'เงินสด / กะ', icon: '💵' },
  { to: '/reports', label: 'รายงานรายได้', icon: '📊' },
  { to: '/settings', label: 'ตั้งค่า', icon: '⚙️', managerOnly: true },
  { to: '/users', label: 'ผู้ใช้งาน', icon: '👤', managerOnly: true },
];

export function Layout() {
  const { user, logout, isManager } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api
        .get<{ orders: CustomerOrder[] }>('/orders?status=pending')
        .then((r) => alive && setPending(r.orders.length))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-60 flex-col bg-ink text-bone">
        <div className="px-5 py-5">
          <div className="text-lg font-bold tracking-tight">ระบบจัดการโรงแรม</div>
          <div className="text-xs text-bone/50">20 ห้อง · อาคาร A &amp; B</div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => !n.managerOnly || isManager).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-amber-brand text-white' : 'text-bone/80 hover:bg-ink-soft'
                }`
              }
            >
              <span className="w-5 text-center">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.badge && pending > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{pending}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-bone/10 px-5 py-4">
          <div className="text-sm font-semibold">{user?.displayName}</div>
          <div className="mb-3 text-xs text-bone/50">{isManager ? 'ผู้จัดการ' : 'พนักงาน'}</div>
          <button onClick={logout} className="text-xs text-bone/70 underline hover:text-bone">
            ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden bg-bone">
        <Outlet />
      </main>
    </div>
  );
}
