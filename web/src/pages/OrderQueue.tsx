import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { baht, dateTimeOf } from '../lib/format';
import type { CustomerOrder } from '../lib/types';

export function OrderQueue() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ orders: CustomerOrder[] }>('/orders?status=pending').then((r) => setOrders(r.orders)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function handle(id: number, action: 'accept' | 'reject') {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/${action}`);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">คำสั่งซื้อจากลูกค้า</h1>
      <p className="mb-6 text-sm text-ink/50">รายการที่ลูกค้าสั่งผ่านแอปในห้องพัก</p>

      {orders.length === 0 ? (
        <div className="card grid h-48 place-items-center text-ink/40">ไม่มีคำสั่งซื้อที่รอดำเนินการ</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const total = o.items.reduce((s, i) => s + i.unit_price * i.qty, 0);
            return (
              <div key={o.id} className="card flex flex-col p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-bone">ห้อง {o.room_label}</span>
                  <span className="text-xs text-ink/40">{dateTimeOf(o.created_at)}</span>
                </div>
                <ul className="mb-3 flex-1 space-y-1 text-sm">
                  {o.items.map((it, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>
                        {it.name} ×{it.qty}
                      </span>
                      <span className="text-ink/60">{baht(it.unit_price * it.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-3 flex justify-between border-t border-ink/10 pt-2 font-bold">
                  <span>รวม</span>
                  <span className="text-amber-deep">{baht(total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost text-red-600" disabled={busy} onClick={() => handle(o.id, 'reject')}>
                    ปฏิเสธ
                  </button>
                  <button className="btn-accent" disabled={busy} onClick={() => handle(o.id, 'accept')}>
                    รับออเดอร์
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
