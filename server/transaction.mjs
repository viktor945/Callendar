// Both adapters keep each multi-statement change atomic.
export function transaction(db, action) {
  if (db.transactionSync) return db.transactionSync(action);
  db.exec('BEGIN');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
