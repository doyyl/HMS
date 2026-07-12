import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { baht } from '../lib/format';
import type { Product } from '../lib/types';

interface RoomInfo {
  room: { label: string };
  canOrder: boolean;
  products: Product[];
}

export function CustomerOrder() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/public/room/${token}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError('ไม่พบห้องพัก'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function setQty(id: number, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  const items = Object.entries(cart).map(([id, qty]) => ({ productId: Number(id), qty }));
  const total = items.reduce((s, it) => {
    const p = info?.products.find((x) => x.id === it.productId);
    return s + (p ? p.price * it.qty : 0);
  }, 0);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/public/room/${token}/order`, { items });
      setPlaced(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สั่งซื้อไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  if (!info) {
    return <div className="grid h-screen place-items-center text-ink/50">{error ?? 'กำลังโหลด…'}</div>;
  }

  if (placed) {
    return (
      <div className="grid min-h-screen place-items-center bg-bone p-6 text-center">
        <div>
          <div className="mb-3 text-5xl">✅</div>
          <h1 className="text-xl font-bold">ส่งคำสั่งซื้อแล้ว</h1>
          <p className="mt-2 text-ink/60">พนักงานจะนำสินค้าไปส่งที่ห้อง {info.room.label}</p>
          <button
            className="btn-accent mt-6"
            onClick={() => {
              setCart({});
              setPlaced(false);
              load();
            }}
          >
            สั่งเพิ่ม
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bone pb-28">
      <header className="bg-ink px-5 py-5 text-bone">
        <div className="text-sm text-bone/60">สั่งสินค้าเข้าห้อง</div>
        <div className="text-2xl font-bold">ห้อง {info.room.label}</div>
      </header>

      {!info.canOrder && (
        <div className="m-4 rounded-lg bg-amber-brand/10 px-4 py-3 text-sm text-amber-deep">
          ขณะนี้ยังไม่สามารถสั่งซื้อได้ กรุณาติดต่อพนักงานต้อนรับ
        </div>
      )}

      <div className="space-y-3 p-4">
        {info.products.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 p-4">
            <div className="flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-amber-deep">{baht(p.price)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-outline h-9 w-9 p-0" onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)}>
                −
              </button>
              <span className="w-6 text-center font-semibold">{cart[p.id] ?? 0}</span>
              <button className="btn-outline h-9 w-9 p-0" onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && info.canOrder && (
        <div className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-white p-4">
          {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
          <button className="btn-accent w-full text-base" disabled={busy} onClick={submit}>
            สั่งซื้อ · {baht(total)}
          </button>
        </div>
      )}
    </div>
  );
}
