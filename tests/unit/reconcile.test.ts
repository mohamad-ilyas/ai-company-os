import { describe, expect, it } from "vitest";
import { decide } from "@/lib/cloud/reconcile";

const uid = "user-1";

describe("cloud sync decisions", () => {
  it("seeds the cloud from the first device", () => {
    expect(decide({ owner: null, base: 0, dirty: false }, uid, null)).toEqual({ kind: "push", base: 0 });
    // Cloud row missing even though this device synced before (e.g. deleted in the dashboard): re-seed.
    expect(decide({ owner: uid, base: 7, dirty: false }, uid, null)).toEqual({ kind: "push", base: 0 });
  });

  it("a new device takes the cloud copy and backs up what it had", () => {
    expect(decide({ owner: null, base: 0, dirty: true }, uid, 5)).toEqual({ kind: "pull", backupLocal: true });
    expect(decide({ owner: "someone-else", base: 5, dirty: false }, uid, 5)).toEqual({ kind: "pull", backupLocal: true });
  });

  it("does nothing when already in sync", () => {
    expect(decide({ owner: uid, base: 5, dirty: false }, uid, 5)).toEqual({ kind: "none" });
  });

  it("uploads local edits made on top of the latest cloud copy", () => {
    expect(decide({ owner: uid, base: 5, dirty: true }, uid, 5)).toEqual({ kind: "push", base: 5 });
  });

  it("pulls changes made on another device", () => {
    expect(decide({ owner: uid, base: 5, dirty: false }, uid, 8)).toEqual({ kind: "pull", backupLocal: false });
  });

  it("flags a conflict when both devices changed since the last sync", () => {
    expect(decide({ owner: uid, base: 5, dirty: true }, uid, 6)).toEqual({ kind: "conflict" });
  });

  it("trusts the cloud if it is behind this device (restored backup)", () => {
    expect(decide({ owner: uid, base: 9, dirty: false }, uid, 3)).toEqual({ kind: "pull", backupLocal: false });
    expect(decide({ owner: uid, base: 9, dirty: true }, uid, 3)).toEqual({ kind: "pull", backupLocal: true });
  });
});
