import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { baht } from '../lib/format';
import { ErrorNote } from './Modal';
import type { Room } from '../lib/types';

export function CheckInForm({ room, onDone }: { room: Room; onDone: () => void }) {
  const [type, setType] = useState<'short' | 'overnight'>('short');
  const [plate, setPlate] = useState('');
  const [province, setProvince] = useState('');
  const [payEarly, setPayEarly] = useState(false);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ provinces: string[]; settings: Record<string, string> }>('/settings')
      .then((r) => {
        setProvinces(r.provinces);
        setSettings(r.settings);
      })
      .catch(() => {});
  }, []);

  const isEarly = new Date().getHours() < Number(settings.OVERNIGHT_CHECKIN_HOUR ?? 11);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await api.post('/bookings', {
        roomId: room.id,
        type,
        licensePlate: plate.trim() || null,
        province: province || null,
        payEarlyExtend: type === 'overnight' && isEarly ? payEarly : false,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เช็คอินไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const shortBase = Number(settings.SHORT_BASE_PRICE ?? 200);
  const overnight = Number(settings.OVERNIGHT_PRICE ?? 500);
  const earlyFee = Number(settings.EARLY_CHECKIN_FEE ?? 50);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(['short', 'overnight'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-xl border-2 p-4 text-left transition ${
              type === t ? 'border-amber-brand bg-amber-brand/5' : 'border-ink/10 hover:border-ink/25'
            }`}
          >
            <div className="font-bold">{t === 'short' ? 'ชั่วคราว' : 'ค้างคืน'}</div>
            <div className="text-sm text-ink/60">
              {t === 'short' ? `${baht(shortBase)} / 2 ชม.` : `${baht(overnight)} / คืน`}
            </div>
          </button>
        ))}
      </div>

      <div>
        <label className="label">ทะเบียนรถ</label>
        <input className="input" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="เช่น กข 1234" />
      </div>
      <div>
        <label className="label">จังหวัด</label>
        <select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">— ไม่ระบุ —</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {type === 'overnight' && isEarly && (
        <label className="flex items-start gap-3 rounded-lg bg-amber-brand/5 p-3 text-sm">
          <input type="checkbox" checked={payEarly} onChange={(e) => setPayEarly(e.target.checked)} className="mt-0.5" />
          <span>
            เข้าก่อน 11:00 — จ่าย <b>{baht(earlyFee)}</b> เพื่อเลื่อนเช็คเอาท์เป็น 11:00 วันรุ่งขึ้น
            <br />
            <span className="text-ink/50">หากไม่จ่าย ต้องเช็คเอาท์ 18:00 วันนี้</span>
          </span>
        </label>
      )}

      <ErrorNote message={error} />
      <div className="flex justify-end gap-2">
        <button className="btn-accent" onClick={submit} disabled={busy}>
          เช็คอิน {room.label}
        </button>
      </div>
    </div>
  );
}
