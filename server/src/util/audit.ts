import { run } from '../db/index.js';

export async function audit(
  userId: number | null,
  action: string,
  entity?: string,
  entityId?: number,
  detail?: string,
): Promise<void> {
  await run('INSERT INTO audit_log(user_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)', [
    userId,
    action,
    entity ?? null,
    entityId ?? null,
    detail ?? null,
  ]);
}
