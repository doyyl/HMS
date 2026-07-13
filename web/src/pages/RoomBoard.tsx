import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { baht, timeOf, untilLabel } from '../lib/format';
import { Modal } from '../components/Modal';
import { CheckInForm } from '../components/CheckInForm';
import { ManageBooking } from '../components/ManageBooking';
import type { Room } from '../lib/types';

export function RoomBoard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [manageBookingId, setManageBookingId] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // A reservation check-in redirects here with the new booking id to open.
  useEffect(() => {
    const openBooking = (location.state as { openBooking?: number } | null)?.openBooking;
    if (openBooking) {
      setManageBookingId(openBooking);
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  const load = useCallback(() => {
    api.get<{ rooms: Room[] }>('/rooms').then((r) => setRooms(r.rooms)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const buildings: Array<'A' | 'B'> = ['A', 'B'];
  const stats = {
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    dirty: rooms.filter((r) => r.cleaning_status !== 'clean' && r.status === 'available').length,
  };

  async function markClean(room: Room) {
    await api.patch(`/rooms/${room.id}/cleaning`, { cleaning_status: 'clean' });
    load();
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ผังห้องพัก</h1>
          <p className="text-sm text-ink/50">
            เข้าพัก {stats.occupied}/20 ห้อง · รอทำความสะอาด {stats.dirty} ห้อง
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <Legend color="bg-emerald-500" label="ว่าง" />
          <Legend color="bg-amber-brand" label="เข้าพัก" />
          <Legend color="bg-red-500" label="เกินเวลา" />
          <Legend color="bg-ink/30" label="รอทำความสะอาด" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {buildings.map((bd) => (
          <section key={bd} className="card p-5">
            <h2 className="mb-4 text-lg font-bold">อาคาร {bd}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {rooms
                .filter((r) => r.building === bd)
                .map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onClick={() => {
                      if (room.status === 'occupied' && room.current_booking_id) setManageBookingId(room.current_booking_id);
                      else if (room.cleaning_status === 'clean') setCheckInRoom(room);
                    }}
                    onClean={() => markClean(room)}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>

      {checkInRoom && (
        <Modal title={`เช็คอิน — ห้อง ${checkInRoom.label}`} onClose={() => setCheckInRoom(null)}>
          <CheckInForm
            room={checkInRoom}
            onDone={() => {
              setCheckInRoom(null);
              load();
            }}
          />
        </Modal>
      )}
      {manageBookingId && (
        <ManageBooking bookingId={manageBookingId} onClose={() => setManageBookingId(null)} onChanged={load} />
      )}
    </div>
  );
}

function RoomCard({ room, onClick, onClean }: { room: Room; onClick: () => void; onClean: () => void }) {
  const occupied = room.status === 'occupied';
  const dirty = room.cleaning_status !== 'clean' && !occupied;
  const until = untilLabel(room.expected_checkout_at);

  let tone = 'border-emerald-400/60 bg-emerald-50';
  if (occupied) tone = until.overdue ? 'border-red-400 bg-red-50' : 'border-amber-brand/60 bg-amber-brand/5';
  if (dirty) tone = 'border-ink/15 bg-sand/50';

  return (
    <button
      onClick={onClick}
      className={`relative flex h-28 flex-col rounded-xl border-2 p-3 text-left transition hover:shadow-card ${tone}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{room.label}</span>
        {occupied && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-bone">
            {room.converted_overnight || room.type === 'overnight' ? 'ค้างคืน' : 'ชั่วคราว'}
          </span>
        )}
      </div>
      {occupied ? (
        <div className="mt-auto">
          <div className={`text-xs font-medium ${until.overdue ? 'text-red-600' : 'text-ink/60'}`}>
            ออก {timeOf(room.expected_checkout_at)}
          </div>
          <div className="text-sm font-bold text-amber-deep">{baht(room.room_total)}</div>
        </div>
      ) : dirty ? (
        <div className="mt-auto">
          <div className="mb-1 text-xs text-ink/50">รอทำความสะอาด</div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClean();
            }}
            className="inline-block rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-bone hover:bg-ink-soft"
          >
            ทำความสะอาดเสร็จ
          </span>
        </div>
      ) : (
        <div className="mt-auto text-sm font-semibold text-emerald-700">ว่าง · พร้อมรับ</div>
      )}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}
