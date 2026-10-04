import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe.each([
  ["darwin", "/connector", "/connector"],
  ["darwin", "file:///Library/Application%20Support/MCP%20%C3%A9", "/Library/Application Support/MCP é"],
  ["win32", "C:\\connector", "C:\\connector"],
  ["win32", "file:///C:/Program%20Files/MCP%20%C3%A9", "C:/Program Files/MCP é"],
] as const)("manually maintained CEP connector: %s %s", (platform, systemPath, extensionPath) => {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
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
    const writeFileSync = vi.fn();
    const getSystemPath = vi.fn(() => systemPath);
    const modules: Record<string, unknown> = {
      fs: { existsSync: (file: string) => manual && file === pathApi.join(extensionPath, "manual-updates"), writeFileSync, renameSync: vi.fn() },
      path: pathApi, https, os: { platform: () => platform, tmpdir: () => "/synthetic" },
      process: { env: {} }, child_process: { spawn },
    };
    const context = {
      __adobe_cep__: { getSystemPath, evalScript: vi.fn() },
      require: (name: string) => modules[name], Buffer,
      document: { getElementById, createElement: element },
      localStorage: { getItem: () => null },
      MCPBridgeDirectorySecurity: { createBridgeDirectorySecurity: () => ({ ensurePrivateBridgeDirectory: (dir: string) => dir }) },
      MCPBridgeUpdater: { CURRENT_VERSION: "test", LATEST_PACKAGE_API: "https://registry.example.test" },
      setInterval: vi.fn(), clearInterval: vi.fn(),
      setTimeout: (callback: () => void) => { timers.push(callback); },
    };
    // Execute the actual panel entry point, including initialization and click handling.
    runInNewContext(readFileSync("cep-plugin/CSInterface.js", "utf8"), context);
    runInNewContext(readFileSync("cep-plugin/main.js", "utf8"), context);
    for (const timer of timers) timer();
    runInNewContext("handleUpdateClick()", context);
    expect(getSystemPath).toHaveBeenCalledWith("extension");
    expect(JSON.parse(writeFileSync.mock.calls.at(-1)![1])).toEqual({ protocolVersion: 1, state: "running" });
    expect(context.setInterval).toHaveBeenCalledWith(expect.any(Function), 200);
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
