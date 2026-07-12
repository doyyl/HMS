import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { baht } from '../lib/format';
import { Modal, ErrorNote } from './Modal';

const RECEIPT_LABELS: Record<string, string> = {
  none: 'ไม่รับใบเสร็จ',
  receipt: 'ใบเสร็จรับเงิน',
  invoice: 'ใบกำกับภาษี',
};

export function PaymentDialog({
  bookingId,
  amount,
  onClose,
  onPaid,
}: {
  bookingId?: number;
  amount: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<'cash' | 'qr'>('cash');
  const [receiptType, setReceiptType] = useState('none');
  const [receiptTypes, setReceiptTypes] = useState<string[]>(['none', 'receipt', 'invoice']);
  const [amt, setAmt] = useState(amount);
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ receiptTypes: string[] }>('/settings').then((r) => setReceiptTypes(r.receiptTypes)).catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    if (method === 'qr' && !slip) {
      setError('การชำระแบบ QR ต้องแนบรูปสลิป');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('amount', String(amt));
      form.append('method', method);
      form.append('receiptType', receiptType);
      if (bookingId) form.append('bookingId', String(bookingId));
      if (slip) form.append('slip', slip);
      await api.postForm('/payments', form);
      onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกการชำระไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="รับชำระเงิน" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-ink p-4 text-center text-bone">
          <div className="text-xs text-bone/60">ยอดที่ต้องชำระ</div>
          <div className="text-3xl font-bold">{baht(amt)}</div>
        </div>

        <div>
          <label className="label">วิธีชำระ</label>
          <div className="grid grid-cols-2 gap-3">
            {(['cash', 'qr'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`rounded-xl border-2 py-3 font-semibold transition ${
                  method === m ? 'border-amber-brand bg-amber-brand/5' : 'border-ink/10 hover:border-ink/25'
                }`}
              >
                {m === 'cash' ? '💵 เงินสด' : '📱 QR / โอน'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">จำนวนเงิน</label>
          <input
            className="input"
            type="number"
            value={amt}
            onChange={(e) => setAmt(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="label">ประเภทใบเสร็จ</label>
          <select className="input" value={receiptType} onChange={(e) => setReceiptType(e.target.value)}>
            {receiptTypes.map((t) => (
              <option key={t} value={t}>
                {RECEIPT_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>

        {method === 'qr' && (
          <div>
            <label className="label">แนบรูปสลิป (จำเป็น)</label>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
            />
            {slip && <p className="mt-1 text-xs text-ink/50">{slip.name}</p>}
          </div>
        )}

        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn-accent" onClick={submit} disabled={busy}>
            ยืนยันการชำระ
          </button>
        </div>
      </div>
    </Modal>
  );
}
