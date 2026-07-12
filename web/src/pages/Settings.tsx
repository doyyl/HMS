import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorNote } from '../components/Modal';

const FIELDS: Array<{ key: string; label: string; hint?: string }> = [
  { key: 'SHORT_BASE_PRICE', label: 'ราคาชั่วคราว (บาท)', hint: 'ราคาพื้นฐาน 2 ชม.แรก' },
  { key: 'SHORT_BASE_HOURS', label: 'ชั่วโมงพื้นฐาน' },
  { key: 'SHORT_EXT_PRICE', label: 'ค่าต่อเวลา/ชม. (บาท)' },
  { key: 'CONVERT_TOTAL_THRESHOLD', label: 'เกณฑ์ยอดเงินเสนอค้างคืน (บาท)' },
  { key: 'CONVERT_EXT_HOURS_THRESHOLD', label: 'เกณฑ์ชั่วโมงเสนอค้างคืน' },
  { key: 'OVERNIGHT_PRICE', label: 'ราคาค้างคืน (บาท)' },
  { key: 'OVERNIGHT_CHECKIN_HOUR', label: 'เวลาเช็คอินมาตรฐาน (ชม.)' },
  { key: 'OVERNIGHT_CHECKOUT_HOUR', label: 'เวลาเช็คเอาท์มาตรฐาน (ชม.)' },
  { key: 'EARLY_CHECKOUT_HOUR', label: 'เวลาเช็คเอาท์กรณีเข้าก่อนเวลา (ชม.)' },
  { key: 'EARLY_CHECKIN_FEE', label: 'ค่าเข้าก่อนเวลา (บาท)' },
];

export function Settings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ settings: Record<string, string> }>('/settings').then((r) => setValues(r.settings)).catch(() => {});
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const subset: Record<string, string> = {};
      for (const f of FIELDS) subset[f.key] = values[f.key] ?? '';
      await api.put('/settings', { settings: subset });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">ตั้งค่าราคาและเวลา</h1>
      <p className="mb-6 text-sm text-ink/50">ปรับราคาห้องพักและเงื่อนไขเวลา (เฉพาะผู้จัดการ)</p>

      <div className="max-w-2xl">
        <div className="card grid gap-4 p-6 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                type="number"
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {f.hint && <p className="mt-1 text-xs text-ink/40">{f.hint}</p>}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-accent" onClick={save} disabled={busy}>
            บันทึกการตั้งค่า
          </button>
          {saved && <span className="text-sm font-medium text-emerald-700">บันทึกแล้ว ✓</span>}
        </div>
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      </div>
    </div>
  );
}
