import { useState } from 'react';
import { api } from '../lib/api';
import { Modal, ErrorNote } from './Modal';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (newPassword.length < 8) return setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
    if (newPassword !== confirm) return setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}>
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-emerald-700">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</p>
          <button className="btn-accent min-h-[44px]" onClick={onClose}>
            ปิด
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <ErrorNote message={error} />
          <div>
            <label className="label">รหัสผ่านปัจจุบัน</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">ยืนยันรหัสผ่านใหม่</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button className="btn-accent min-h-[44px] w-full" disabled={busy} onClick={submit}>
            บันทึกรหัสผ่านใหม่
          </button>
        </div>
      )}
    </Modal>
  );
}
