import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { baht } from '../lib/format';
import type { Report } from '../lib/types';

const PERIODS: Array<{ key: Report['period']; label: string }> = [
  { key: 'day', label: 'รายวัน' },
  { key: 'month', label: 'รายเดือน' },
  { key: 'year', label: 'รายปี' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Reports() {
  const [period, setPeriod] = useState<Report['period']>('day');
  const [date, setDate] = useState(today());
  const [report, setReport] = useState<Report | null>(null);

  const load = useCallback(() => {
    api.get<Report>(`/reports?period=${period}&date=${date}`).then(setReport).catch(() => {});
  }, [period, date]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!report) return;
    const rows = [
      ['ช่วง', report.label],
      ['เงินสด', report.received.cash],
      ['QR/โอน', report.received.qr],
      ['รับรวม', report.received.total],
      ['ค่าห้องชั่วคราว', report.charges.roomShort],
      ['ค่าห้องค้างคืน', report.charges.roomOvernight],
      ['สินค้าเสริม', report.charges.supplementary],
      ['จำนวนการเข้าพัก', report.bookings],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `report-${report.label}.csv`;
    a.click();
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">รายงานรายได้</h1>
          <p className="text-sm text-ink/50">สรุปรายรับ แยกตามเงินสด / QR และหมวดหมู่</p>
        </div>
        <button className="btn-outline no-print" onClick={exportCsv}>
          ส่งออก CSV
        </button>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-sand p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                period === p.key ? 'bg-ink text-bone' : 'text-ink/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {report && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-bold">เงินที่รับเข้า</h2>
            <BigRow label="เงินสด 💵" value={report.received.cash} />
            <BigRow label="QR / โอน 📱" value={report.received.qr} />
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 text-xl font-bold">
              <span>รวมรับ</span>
              <span className="text-amber-deep">{baht(report.received.total)}</span>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-lg font-bold">แยกตามหมวด</h2>
            <BigRow label="ค่าห้อง — ชั่วคราว" value={report.charges.roomShort} />
            <BigRow label="ค่าห้อง — ค้างคืน" value={report.charges.roomOvernight} />
            <BigRow label="สินค้าเสริม" value={report.charges.supplementary} />
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 text-sm text-ink/60">
              <span>จำนวนการเข้าพักที่ปิดรายการ</span>
              <span className="font-bold">{report.bookings} ครั้ง</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BigRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-ink/70">{label}</span>
      <span className="text-lg font-semibold">{baht(value)}</span>
    </div>
  );
}
