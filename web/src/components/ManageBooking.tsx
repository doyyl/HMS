import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { baht, dateTimeOf, untilLabel } from '../lib/format';
import { Modal, ErrorNote } from './Modal';
import { PaymentDialog } from './PaymentDialog';
import type { Folio, Product } from '../lib/types';

export function ManageBooking({
  bookingId,
  onClose,
  onChanged,
}: {
  bookingId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [folio, setFolio] = useState<Folio | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | ''>('');
  const [qty, setQty] = useState(1);
  const [offerOvernight, setOfferOvernight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    api.get<Folio>(`/bookings/${bookingId}/folio`).then(setFolio).catch((e) => setError(e.message));
  }, [bookingId]);

  useEffect(() => {
    load();
    api.get<{ products: Product[] }>('/products').then((r) => setProducts(r.products)).catch(() => {});
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function extend() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ offerOvernight: boolean }>(`/bookings/${bookingId}/extend`);
      setOfferOvernight(r.offerOvernight);
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ต่อเวลาไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (!productId) return;
    await act(() => api.post('/sales', { bookingId, productId, qty }));
    setQty(1);
    setProductId('');
  }

  if (!folio) return <Modal title="กำลังโหลด…" onClose={onClose}><div /></Modal>;

  const b = folio.booking;
  const isShort = b.type === 'short' && !b.converted_overnight;
  const until = untilLabel(b.expected_checkout_at);
  const typeLabel = b.converted_overnight ? 'ค้างคืน (แปลงจากชั่วคราว)' : b.type === 'short' ? 'ชั่วคราว' : 'ค้างคืน';

  return (
    <Modal title={`ห้อง ${folio.roomLabel}`} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Stay details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bone">{typeLabel}</span>
            <span className={`text-sm font-medium ${until.overdue ? 'text-red-600' : 'text-ink/60'}`}>{until.text}</span>
          </div>
          <dl className="space-y-1 text-sm">
            <Row k="เช็คอิน" v={dateTimeOf(b.check_in_at)} />
            <Row k="กำหนดเช็คเอาท์" v={dateTimeOf(b.expected_checkout_at)} />
            {b.license_plate && <Row k="ทะเบียนรถ" v={`${b.license_plate} ${b.province ?? ''}`} />}
          </dl>

          {isShort && (
            <div className="space-y-2 rounded-xl bg-sand/60 p-3">
              <button className="btn-outline w-full" onClick={extend} disabled={busy}>
                ต่อเวลา +1 ชม. (+{baht(50)})
              </button>
              {offerOvernight && (
                <button
                  className="btn-accent w-full"
                  onClick={() => act(() => api.post(`/bookings/${bookingId}/convert-overnight`))}
                  disabled={busy}
                >
                  แปลงเป็นค้างคืน (เหมา {baht(500)})
                </button>
              )}
            </div>
          )}

          {/* Add supplementary */}
          <div className="rounded-xl border border-ink/10 p-3">
            <div className="label">เพิ่มสินค้า</div>
            <div className="flex gap-2">
              <select className="input" value={productId} onChange={(e) => setProductId(Number(e.target.value) || '')}>
                <option value="">— เลือกสินค้า —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {baht(p.price)}
                  </option>
                ))}
              </select>
              <input
                className="input w-20"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              />
              <button className="btn-primary" onClick={addItem} disabled={busy || !productId}>
                เพิ่ม
              </button>
            </div>
          </div>
        </div>

        {/* Folio */}
        <div className="flex flex-col">
          <div className="flex-1 rounded-xl border border-ink/10 p-4">
            <div className="mb-2 text-sm font-bold">ใบแจ้งหนี้</div>
            <Line label={`ค่าห้อง (${typeLabel})`} value={b.room_total} />
            {folio.items.map((it) => (
              <Line
                key={it.id}
                label={`${it.name} ×${it.qty}${it.source === 'customer' ? ' 🛎️' : ''}`}
                value={it.line_total}
                onDelete={() => act(() => api.del(`/sales/${it.id}`))}
              />
            ))}
            <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
              <span className="font-bold">รวมทั้งสิ้น</span>
              <span className="text-2xl font-bold text-amber-deep">{baht(folio.grandTotal)}</span>
            </div>
          </div>

          <ErrorNote message={error} />
          <div className="mt-3 grid gap-2">
            <button className="btn-accent" onClick={() => setPaying(true)} disabled={busy}>
              รับชำระ &amp; เช็คเอาท์ · {baht(folio.grandTotal)}
            </button>
            <button
              className="btn-ghost text-sm text-red-600"
              onClick={() => {
                if (confirm('ยกเลิกการเข้าพักนี้?')) act(() => api.post(`/bookings/${bookingId}/void`)).then(onClose);
              }}
            >
              ยกเลิกการเข้าพัก
            </button>
          </div>
        </div>
      </div>

      {paying && (
        <PaymentDialog
          bookingId={bookingId}
          amount={folio.grandTotal}
          onClose={() => setPaying(false)}
          onPaid={async () => {
            await api.post(`/bookings/${bookingId}/checkout`);
            setPaying(false);
            onChanged();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/50">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Line({
  label,
  value,
  onDelete,
}: {
  label: string;
  value: number;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="flex items-center gap-2">
        {label}
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-red-500 hover:underline">
            ลบ
          </button>
        )}
      </span>
      <span className="font-medium">{baht(value)}</span>
    </div>
  );
}
