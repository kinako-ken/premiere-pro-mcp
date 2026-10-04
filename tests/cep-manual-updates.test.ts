import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("manually maintained CEP connector", () => {
  it.each([true, false])("honors the packaged manual-updates marker: %s", manual => {
    const elements = new Map<string, any>();
    const element = () => ({ children: [], appendChild: vi.fn(), setAttribute: vi.fn(), getElementsByTagName: () => [{}] });
    const getElementById = (id: string) => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    };
    const request = { setTimeout: vi.fn(), on: vi.fn() };
    const https = { get: vi.fn(() => request) };
    const spawn = vi.fn();
    const timers: Array<() => void> = [];
    const modules: Record<string, unknown> = {
      fs: { existsSync: (file: string) => manual && file === path.join("/connector", "manual-updates"), writeFileSync: vi.fn(), renameSync: vi.fn() },
      path, https, os: { platform: () => "darwin", tmpdir: () => "/synthetic" },
      process: { env: {} }, child_process: { spawn },
    };
    const context = {
      CSInterface: function () { return { getSystemPath: () => "/connector" }; },
      SystemPath: { EXTENSION: "extension" },
      require: (name: string) => modules[name], Buffer,
      document: { getElementById, createElement: element },
      localStorage: { getItem: () => null },
      MCPBridgeDirectorySecurity: { createBridgeDirectorySecurity: () => ({ ensurePrivateBridgeDirectory: (dir: string) => dir }) },
      MCPBridgeUpdater: { CURRENT_VERSION: "test", LATEST_PACKAGE_API: "https://registry.example.test" },
      setInterval: vi.fn(), clearInterval: vi.fn(),
      setTimeout: (callback: () => void, delay: number) => { if (delay === 1200) timers.push(callback); },
    };
    // Execute the actual panel entry point, including initialization and click handling.
    runInNewContext(readFileSync("cep-plugin/main.js", "utf8"), context);
    for (const timer of timers) timer();
    runInNewContext("handleUpdateClick()", context);
    if (manual) {
      expect(https.get).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
      expect(getElementById("btnUpdate").disabled).toBe(true);
      expect(getElementById("updateTitle").textContent).toBe("Manual updates");
    } else {
      expect(https.get).toHaveBeenCalledTimes(2);
    }
  });
});
