import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { baht } from '../lib/format';
import { PaymentDialog } from '../components/PaymentDialog';
import type { Product } from '../lib/types';

interface CartLine {
  product: Product;
  qty: number;
}

export function Pos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get<{ products: Product[] }>('/products').then((r) => setProducts(r.products)).catch(() => {});
  }, []);

  function add(product: Product) {
    setCart((c) => {
      const found = c.find((l) => l.product.id === product.id);
      if (found) return c.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { product, qty: 1 }];
    });
  }
  function setQty(id: number, qty: number) {
    setCart((c) => (qty <= 0 ? c.filter((l) => l.product.id !== id) : c.map((l) => (l.product.id === id ? { ...l, qty } : l))));
  }

  const total = cart.reduce((s, l) => s + l.product.price * l.qty, 0);

  async function commitSales() {
    for (const line of cart) {
      await api.post('/sales', { productId: line.product.id, qty: line.qty });
    }
  }

  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="mb-1 text-2xl font-bold">ขายสินค้า</h1>
        <p className="mb-6 text-sm text-ink/50">ขายสินค้าหน้าร้าน (ไม่ผูกกับห้องพัก)</p>
        {categories.map((cat) => (
          <div key={cat} className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-ink/60">{cat}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products
                .filter((p) => p.category === cat)
                .map((p) => (
                  <button key={p.id} onClick={() => add(p)} className="card p-4 text-left transition hover:shadow-card">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-amber-deep">{baht(p.price)}</div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <aside className="card flex h-fit flex-col p-5">
        <h2 className="mb-3 text-lg font-bold">ตะกร้า</h2>
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">ยังไม่มีสินค้า</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {cart.map((l) => (
              <li key={l.product.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{l.product.name}</span>
                <input
                  type="number"
                  min={0}
                  value={l.qty}
                  onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                  className="input w-16 px-2 py-1"
                />
                <span className="w-16 text-right font-medium">{baht(l.product.price * l.qty)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mb-4 flex justify-between border-t border-ink/10 pt-3 text-lg font-bold">
          <span>รวม</span>
          <span className="text-amber-deep">{baht(total)}</span>
        </div>
        <button className="btn-accent" disabled={cart.length === 0} onClick={() => setPaying(true)}>
          รับชำระ
        </button>
      </aside>

      {paying && (
        <PaymentDialog
          amount={total}
          onClose={() => setPaying(false)}
          onPaid={async () => {
            await commitSales();
            setCart([]);
            setPaying(false);
          }}
        />
      )}
    </div>
  );
}
