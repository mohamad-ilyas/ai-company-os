// Pure sync decision, kept separate so it can be unit-tested.
//
// Each device remembers which account it last synced with (`owner`), the cloud
// revision it last saw (`base`), and whether it has local changes not yet
// uploaded (`dirty`). The cloud row has a revision that increases on every save.

export interface SyncMeta {
  owner: string | null;
  base: number;
  dirty: boolean;
}

export type SyncDecision =
  /** Upload local state. `base` is the revision the upload is based on (0 = first upload). */
  | { kind: "push"; base: number }
  /** Replace local state with the cloud copy. `backupLocal` keeps the device's copy as a restorable backup. */
  | { kind: "pull"; backupLocal: boolean }
  /** Both sides changed: the cloud copy wins, the local copy is kept as a backup, the user is told. */
  | { kind: "conflict" }
  | { kind: "none" };

export function decide(meta: SyncMeta, uid: string, remoteRevision: number | null): SyncDecision {
  const sameAccount = meta.owner === uid;
  // Nothing in the cloud yet: this device seeds it.
  if (remoteRevision === null) return { kind: "push", base: 0 };
  // First sync on this device (or a different account): the cloud is the source of truth.
  if (!sameAccount) return { kind: "pull", backupLocal: true };
  if (remoteRevision === meta.base) return meta.dirty ? { kind: "push", base: meta.base } : { kind: "none" };
  if (remoteRevision > meta.base) return meta.dirty ? { kind: "conflict" } : { kind: "pull", backupLocal: false };
  // The cloud is behind what this device saw (e.g. restored from a backup): trust the cloud.
  return { kind: "pull", backupLocal: meta.dirty };
}
