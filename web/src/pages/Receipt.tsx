import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { baht, dateTimeOf } from '../lib/format';
import type { ReceiptData } from '../lib/types';

const METHOD_LABEL: Record<string, string> = { cash: 'เงินสด', qr: 'QR', online: 'ออนไลน์' };

export function Receipt() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ReceiptData>(`/bookings/${bookingId}/receipt`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'โหลดใบเสร็จไม่สำเร็จ'));
  }, [bookingId]);

  if (error) return <div className="grid h-screen place-items-center text-red-600">{error}</div>;
  if (!data) return <div className="grid h-screen place-items-center text-ink/50">กำลังโหลด…</div>;

  const roomCharge = data.grandTotal - data.supplementaryTotal;

  return (
    <div className="mx-auto max-w-md p-6 print:p-0">
      <div className="mb-4 flex justify-between gap-2 print:hidden">
        <button className="btn-ghost min-h-[44px]" onClick={() => navigate(-1)}>
          ← กลับ
        </button>
        <button className="btn-accent min-h-[44px]" onClick={() => window.print()}>
          พิมพ์ใบเสร็จ
        </button>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white p-6 text-sm">
        <div className="mb-4 text-center">
          <div className="text-lg font-bold">{data.hotel.name}</div>
          {data.hotel.address && <div className="text-xs text-ink/50">{data.hotel.address}</div>}
        </div>

        <div className="mb-3 flex justify-between text-xs text-ink/60">
          <span>ห้อง {data.roomLabel}</span>
          <span>{dateTimeOf(data.issuedAt)}</span>
        </div>

        <table className="w-full border-t border-ink/10 pt-2">
          <tbody>
            <tr className="border-b border-ink/5">
              <td className="py-1.5">ค่าห้องพัก ({data.booking.type === 'overnight' || data.booking.converted_overnight ? 'ค้างคืน' : 'ชั่วคราว'})</td>
              <td className="py-1.5 text-right">{baht(roomCharge)}</td>
            </tr>
            {data.items.map((it) => (
              <tr key={it.id} className="border-b border-ink/5">
                <td className="py-1.5">
                  {it.name} ×{it.qty}
                </td>
                <td className="py-1.5 text-right">{baht(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-between border-t border-ink/20 pt-2 text-base font-bold">
          <span>รวมทั้งสิ้น</span>
          <span>{baht(data.grandTotal)}</span>
        </div>

        {data.payments.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-ink/10 pt-2 text-xs text-ink/60">
            {data.payments.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>ชำระ ({METHOD_LABEL[p.method] ?? p.method})</span>
                <span>{baht(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-ink">
              <span>ชำระแล้ว</span>
              <span>{baht(data.paidTotal)}</span>
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-xs text-ink/40">ขอบคุณที่ใช้บริการ</div>
      </div>
    </div>
  );
}
