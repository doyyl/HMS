import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { RoomBoard } from './pages/RoomBoard';
import { Pos } from './pages/Pos';
import { OrderQueue } from './pages/OrderQueue';
import { CashDrawer } from './pages/CashDrawer';
import { Reservations } from './pages/Reservations';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { CustomerOrder } from './pages/CustomerOrder';
import { Receipt } from './pages/Receipt';
import type { ReactNode } from 'react';

function Protected({ children, managerOnly }: { children: ReactNode; managerOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center text-ink/50">กำลังโหลด…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (managerOnly && user.role !== 'manager') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/order/:token" element={<CustomerOrder />} />
      <Route
        path="/receipt/:bookingId"
        element={
          <Protected>
            <Receipt />
          </Protected>
        }
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<RoomBoard />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/orders" element={<OrderQueue />} />
        <Route path="/cash" element={<CashDrawer />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/settings"
          element={
            <Protected managerOnly>
              <Settings />
            </Protected>
          }
        />
        <Route
          path="/users"
          element={
            <Protected managerOnly>
              <Users />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
