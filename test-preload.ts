import { mock } from "bun:test";
import { createFsFromVolume, Volume } from "memfs";

mock.module("fs", () => {
  const vol = new Volume();
  const fs = createFsFromVolume(vol);
  (fs as any).default = fs;
  (fs as any).fs = fs;
  return fs;
});
mock.module("node:fs", () => {
  const vol = new Volume();
  const fs = createFsFromVolume(vol);
  (fs as any).default = fs;
  (fs as any).fs = fs;
  return fs;
});
