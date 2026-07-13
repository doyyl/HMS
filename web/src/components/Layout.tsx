import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { ChangePasswordModal } from './ChangePasswordModal';
import type { CustomerOrder } from '../lib/types';

const NAV = [
  { to: '/', label: 'ผังห้องพัก', icon: '▦', end: true },
  { to: '/reservations', label: 'การจองล่วงหน้า', icon: '📅' },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const location = useLocation();

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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const navItems = NAV.filter((n) => !n.managerOnly || isManager);

  const sidebarBody = (
    <>
      <div className="px-5 py-5">
        <div className="text-lg font-bold tracking-tight">ระบบจัดการโรงแรม</div>
        <div className="text-xs text-bone/50">20 ห้อง · อาคาร A &amp; B</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
        <div className="flex flex-col items-start gap-2">
          <button onClick={() => setShowChangePw(true)} className="text-xs text-bone/70 underline hover:text-bone">
            เปลี่ยนรหัสผ่าน
          </button>
          <button onClick={logout} className="text-xs text-bone/70 underline hover:text-bone">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 flex-col bg-ink text-bone md:flex">
        {sidebarBody}
      </aside>

      {/* Mobile top bar */}
      <header className="no-print fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-ink px-3 text-bone md:hidden">
        <button
          type="button"
          aria-label="เปิดเมนู"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="relative flex h-11 w-11 items-center justify-center rounded-lg text-2xl hover:bg-ink-soft"
        >
          ☰
          {pending > 0 && (
            <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {pending}
            </span>
          )}
        </button>
        <div className="text-base font-bold">ระบบจัดการโรงแรม</div>
      </header>

      {/* Mobile drawer + overlay */}
      {drawerOpen && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-[fadeIn_.15s_ease-out]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-ink text-bone shadow-card">
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg text-xl hover:bg-ink-soft"
            >
              ✕
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden bg-bone pt-14 md:pt-0">
        <Outlet />
      </main>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
