import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, ErrorNote } from '../components/Modal';

interface UserRow {
  id: number;
  username: string;
  role: 'manager' | 'staff';
  display_name: string;
  active: number;
}

export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get<{ users: UserRow[] }>('/users').then((r) => setUsers(r.users)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(u: UserRow) {
    await api.put(`/users/${u.id}`, { active: u.active === 0 });
    load();
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">ผู้ใช้งาน</h1>
          <p className="text-sm text-ink/50">จัดการบัญชีพนักงานและผู้จัดการ</p>
        </div>
        <button className="btn-accent" onClick={() => setAdding(true)}>
          + เพิ่มผู้ใช้
        </button>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand text-left text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">ชื่อผู้ใช้</th>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">สิทธิ์</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-ink/5">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.display_name}</td>
                <td className="px-4 py-3">{u.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}</td>
                <td className="px-4 py-3">
                  <span className={u.active ? 'text-emerald-700' : 'text-ink/40'}>{u.active ? 'ใช้งาน' : 'ปิด'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs underline hover:text-amber-deep" onClick={() => toggleActive(u)}>
                    {u.active ? 'ปิดการใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <AddUser
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'manager' | 'staff'>('staff');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await api.post('/users', { username, displayName, password, role });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มผู้ใช้ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="เพิ่มผู้ใช้" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">ชื่อผู้ใช้</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="label">ชื่อ-สกุล</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label">รหัสผ่าน (อย่างน้อย 6 ตัว)</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">สิทธิ์</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'manager' | 'staff')}>
            <option value="staff">พนักงาน</option>
            <option value="manager">ผู้จัดการ</option>
          </select>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn-accent" onClick={submit} disabled={busy}>
            เพิ่ม
          </button>
        </div>
      </div>
    </Modal>
  );
}
