import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { baht, dateTimeOf } from '../lib/format';
import { ErrorNote } from '../components/Modal';
import type { ShiftSummary } from '../lib/types';

export function CashDrawer() {
  const { isManager } = useAuth();
  const [data, setData] = useState<{ shift: ShiftSummary['shift'] | null; summary: ShiftSummary | null }>({
    shift: null,
    summary: null,
  });
  const [openFloat, setOpenFloat] = useState(0);
  const [floatEdit, setFloatEdit] = useState(0);
  const [closeCount, setCloseCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ shift: ShiftSummary['shift'] | null; summary: ShiftSummary | null }>('/shifts/current')
      .then((r) => {
        setData(r);
        setFloatEdit(r.shift?.opening_float ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const s = data.summary;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">เงินสด / กะการทำงาน</h1>
      <p className="mb-6 text-sm text-ink/50">เงินตั้งต้นสำหรับทอนลูกค้า · ปรับได้เฉพาะผู้จัดการ</p>

      <div className="max-w-xl">
        <ErrorNote message={error} />

        {!data.shift ? (
          <div className="card mt-2 space-y-4 p-6">
            <h2 className="text-lg font-bold">เปิดกะใหม่</h2>
            <div>
              <label className="label">เงินตั้งต้น (เงินทอน)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={openFloat}
                disabled={!isManager}
                onChange={(e) => setOpenFloat(Number(e.target.value))}
              />
              {!isManager && <p className="mt-1 text-xs text-ink/40">พนักงานเปิดกะได้ แต่เงินตั้งต้นจะเป็น 0 (ให้ผู้จัดการตั้งค่า)</p>}
            </div>
            <button className="btn-accent" disabled={busy} onClick={() => act(() => api.post('/shifts/open', { opening_float: openFloat }))}>
              เปิดกะ
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="card grid grid-cols-2 gap-4 p-6">
              <Stat label="เงินตั้งต้น (ทอน)" value={baht(s?.shift.opening_float)} />
              <Stat label="เงินสดรับเข้า" value={baht(s?.cashTotal)} />
              <Stat label="รับผ่าน QR" value={baht(s?.qrTotal)} />
              <Stat label="เงินสดที่ควรมีในลิ้นชัก" value={baht(s?.expectedCash)} highlight />
              <div className="col-span-2 text-xs text-ink/40">เปิดกะเมื่อ {dateTimeOf(s?.shift.opened_at as string)}</div>
            </div>

            {isManager && (
              <div className="card flex items-end gap-3 p-5">
                <div className="flex-1">
                  <label className="label">ปรับเงินตั้งต้น (ผู้จัดการ)</label>
                  <input className="input" type="number" min={0} value={floatEdit} onChange={(e) => setFloatEdit(Number(e.target.value))} />
                </div>
                <button
                  className="btn-outline"
                  disabled={busy}
                  onClick={() => act(() => api.patch(`/shifts/${data.shift!.id}/float`, { opening_float: floatEdit }))}
                >
                  บันทึก
                </button>
              </div>
            )}

            <div className="card space-y-4 p-6">
              <h2 className="text-lg font-bold">ปิดกะ</h2>
              {s && s.missingSlips > 0 && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  มีการชำระแบบ QR {s.missingSlips} รายการที่ยังไม่ได้แนบสลิป — ปิดกะไม่ได้จนกว่าจะแนบครบ
                </div>
              )}
              <div>
                <label className="label">นับเงินสดจริงในลิ้นชัก</label>
                <input className="input" type="number" min={0} value={closeCount} onChange={(e) => setCloseCount(Number(e.target.value))} />
                {s && (
                  <p className="mt-1 text-xs text-ink/50">
                    ผลต่างจากที่ควรมี: {baht(closeCount - s.expectedCash)}
                  </p>
                )}
              </div>
              <button
                className="btn-primary"
                disabled={busy || (s ? s.missingSlips > 0 : true)}
                onClick={() => act(() => api.post(`/shifts/${data.shift!.id}/close`, { closing_count: closeCount }))}
              >
                ปิดกะ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink/50">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-amber-deep' : ''}`}>{value}</div>
    </div>
  );
}
