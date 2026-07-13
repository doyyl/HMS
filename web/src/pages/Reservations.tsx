import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { baht } from '../lib/format';
import { ErrorNote } from '../components/Modal';
import type { AvailableRoom, Reservation } from '../lib/types';

const STATUS_LABEL: Record<Reservation['status'], string> = {
  pending_payment: 'รอชำระเงิน',
  confirmed: 'ยืนยันแล้ว',
  checked_in: 'เช็คอินแล้ว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  expired: 'หมดเวลา',
  no_show: 'ไม่มาเข้าพัก',
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function Reservations() {
  const navigate = useNavigate();
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ reservations: Reservation[] }>('/reservations?arrivals=today').then((r) => setArrivals(r.reservations)).catch(() => {});
    api.get<{ reservations: Reservation[] }>('/reservations').then((r) => setUpcoming(r.reservations)).catch(() => {});
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

  async function checkIn(id: number) {
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ bookingId: number }>(`/reservations/${id}/check-in`);
      navigate('/', { state: { openBooking: r.bookingId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เช็คอินไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">การจองล่วงหน้า</h1>
      <p className="mb-6 text-sm text-ink/50">รับจองทางโทรศัพท์ · เช็คอินแขกที่จองไว้ · ดูรายการที่จะเข้าพัก</p>

      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <NewReservationForm busy={busy} onCreated={load} onError={setError} />

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">เข้าพักวันนี้ ({arrivals.length})</h2>
            {arrivals.length === 0 ? (
              <p className="text-sm text-ink/40">ยังไม่มีการจองที่เข้าพักวันนี้</p>
            ) : (
              <ul className="space-y-2">
                {arrivals.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand/50 p-3">
                    <div>
                      <div className="font-semibold">
                        ห้อง {r.room_label} · {r.guest_name}
                      </div>
                      <div className="text-xs text-ink/50">
                        {r.guest_phone} · {r.nights} คืน · {baht(r.amount)} · {r.code}
                      </div>
                    </div>
                    <button className="btn-accent min-h-[44px]" disabled={busy} onClick={() => checkIn(r.id)}>
                      เช็คอิน
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">การจองที่กำลังจะมาถึง</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink/40">ยังไม่มีการจอง</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-ink/40">
                    <tr>
                      <th className="py-2">รหัส</th>
                      <th>ห้อง</th>
                      <th>เข้า–ออก</th>
                      <th>แขก</th>
                      <th>ยอด</th>
                      <th>สถานะ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {upcoming.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 font-mono text-xs">{r.code}</td>
                        <td>{r.room_label}</td>
                        <td className="whitespace-nowrap text-xs">
                          {r.check_in_date} → {r.check_out_date}
                        </td>
                        <td>
                          {r.guest_name}
                          <div className="text-xs text-ink/40">{r.guest_phone}</div>
                        </td>
                        <td>{baht(r.amount)}</td>
                        <td>
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs">{STATUS_LABEL[r.status]}</span>
                        </td>
                        <td className="text-right">
                          {(r.status === 'confirmed' || r.status === 'pending_payment') && (
                            <button
                              className="text-xs text-red-600 hover:underline"
                              disabled={busy}
                              onClick={() => act(() => api.post(`/reservations/${r.id}/cancel`))}
                            >
                              ยกเลิก
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NewReservationForm({
  busy,
  onCreated,
  onError,
}: {
  busy: boolean;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [checkIn, setCheckIn] = useState(todayPlus(1));
  const [checkOut, setCheckOut] = useState(todayPlus(2));
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null);
  const [roomId, setRoomId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function search() {
    onError(null);
    setCreated(null);
    setSearching(true);
    try {
      const r = await api.get<{ rooms: AvailableRoom[] }>(
        `/reservations/availability?checkIn=${checkIn}&checkOut=${checkOut}`,
      );
      setRooms(r.rooms);
      setRoomId(r.rooms[0]?.id ?? '');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ค้นหาห้องว่างไม่สำเร็จ');
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (!roomId || !name.trim() || !phone.trim()) return onError('กรอกห้อง ชื่อ และเบอร์โทรให้ครบ');
    onError(null);
    try {
      const r = await api.post<{ reservation: { code: string } }>('/reservations', {
        roomId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestName: name.trim(),
        guestPhone: phone.trim(),
        guestEmail: email.trim() || null,
      });
      setCreated(r.reservation.code);
      setName('');
      setPhone('');
      setEmail('');
      setRooms(null);
      setRoomId('');
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สร้างการจองไม่สำเร็จ');
    }
  }

  return (
    <section className="card h-fit space-y-4 p-5">
      <h2 className="text-lg font-bold">จองใหม่ (ทางโทรศัพท์)</h2>
      {created && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">สร้างการจองแล้ว · รหัส {created}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">เช็คอิน</label>
          <input className="input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div>
          <label className="label">เช็คเอาท์</label>
          <input className="input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
      </div>
      <button className="btn-outline min-h-[44px] w-full" disabled={searching} onClick={search}>
        {searching ? 'กำลังค้นหา…' : 'ค้นหาห้องว่าง'}
      </button>

      {rooms && (
        <>
          <div>
            <label className="label">ห้องว่าง ({rooms.length})</label>
            {rooms.length === 0 ? (
              <p className="text-sm text-red-600">ไม่มีห้องว่างในช่วงวันที่เลือก</p>
            ) : (
              <select className="input" value={roomId} onChange={(e) => setRoomId(Number(e.target.value) || '')}>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    ห้อง {r.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">ชื่อผู้จอง</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">เบอร์โทร</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">อีเมล (ไม่บังคับ)</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn-accent min-h-[44px] w-full" disabled={busy || !roomId} onClick={submit}>
            บันทึกการจอง
          </button>
        </>
      )}
    </section>
  );
}
