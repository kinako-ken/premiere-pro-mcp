import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardToolHandler, isToolPermitted, resolveCapabilities } from "../../src/security/capabilities.js";
import { getExportTools } from "../../src/tools/export.js";
import { getMediaTools } from "../../src/tools/media.js";
import { sendCommand } from "../../src/bridge/file-bridge.js";

vi.mock("../../src/bridge/file-bridge.js", () => ({ sendCommand: vi.fn() }));

beforeEach(() => {
  vi.mocked(sendCommand).mockReset().mockResolvedValue({ success: true, data: {} });
});

describe("CEP proxy authority", () => {
  it.each([
    ["create", "edit", "export"],
    ["create", "edit,filesystem", "export"],
    ["create", "edit,export", "filesystem"],
    ["attach", "edit", "filesystem"],
    ["attach", "filesystem", "edit"],
    ["toggle", "inspect", "edit"],
  ])("denies %s under %s before reaching the bridge", async (action, authority, missing) => {
    const handler = guardToolHandler("manage_proxies", getExportTools({}).manage_proxies.handler, resolveCapabilities(authority));
    // No preset supplied: even auto-discovery must not reach Premiere.
    await expect(handler({ item_id: "synthetic", action, output_path: "/synthetic/proxy.mov" })).rejects.toThrow(missing);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it.each([
    ["create", "export,filesystem"],
    ["attach", "edit,filesystem"],
    ["toggle", "edit"],
  ])("allows %s with its exact authority %s", async (action, authority) => {
    const config = resolveCapabilities(authority);
    expect(isToolPermitted("manage_proxies", config)).toBe(true);
    const handler = guardToolHandler("manage_proxies", getExportTools({}).manage_proxies.handler, config);
    await handler({ item_id: "synthetic", action, output_path: "/synthetic/proxy.mov", preset_path: "/synthetic/proxy.epr", proxy_path: "/synthetic/proxy.mov" });
    expect(sendCommand).toHaveBeenCalledOnce();
  });

  it("keeps proxy inspection read-only and hides mutations from inspect-only clients", async () => {
    const config = resolveCapabilities("inspect");
    expect(isToolPermitted("has_proxy", config)).toBe(true);
    expect(isToolPermitted("manage_proxies", config)).toBe(false);
    await guardToolHandler("has_proxy", getMediaTools({}).has_proxy.handler, config)({ item_id: "synthetic" });
    expect(sendCommand).toHaveBeenCalledOnce();
  });
});
