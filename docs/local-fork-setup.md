# Manually maintained local fork

Build a reviewed commit of your own fork with an installed compatible Node:

```sh
npm ci --ignore-scripts
npm run check
```

Keep the lockfile unchanged. Retain the source commit, source archive, lockfile,
license, built `dist/`, and locked production dependencies together in a private,
versioned installation outside any disposable worktree. Point a stable `current`
symlink at the tested version. Do not run the upstream npm package through `npx`.

## CEP connector

The production source omits `.debug`. For a manually maintained installation,
put an empty `manual-updates` file in the connector directory **before signing**.
This disables its npm polling and update button. The marker belongs to the signed
payload; adding or removing it after signing invalidates the package.

Use Adobe's [packaging and signing guide](https://github.com/Adobe-CEP/Getting-Started-guides/blob/master/Package%20Distribute%20Install/readme.md)
and a reviewed platform-specific `ZXPSignCmd`. Sign a fresh connector staging
directory with a new local certificate, verify the ZXP, extract its complete
contents to a staging directory, and verify that directory too. Retain the
certificate privately and record its expiry. A self-signed ZXP is an integrity
check, not Adobe endorsement or notarization. No operating-system trust-store
change is needed for the packaging procedure.

When Premiere is closed, install that exact verified directory under the user's
Adobe CEP extensions directory. Preserve any previous connector for rollback.
Verify the installed directory again. Never edit an existing signed ZXP or its
installed payload. Inspect existing `PlayerDebugMode` values and leave them
unchanged. The legacy `npm run install-cep` path enables broad debug preferences;
it is not the installation route described here. If the host cannot load the
signed connector, stop and identify the cause before changing security settings.

## Codex

Use a distinct local marketplace/plugin with one MCP registration. Its command
must name the installed Node executable, and its arguments must name
`current/dist/index.js` using an absolute path. Set these per-server environment
values without changing other plugins:

```json
{
  "NODE_ENV": "production",
  "PREMIERE_MCP_CAPABILITIES": "inspect,edit,export,filesystem",
  "PREMIERE_UXP_TOKEN": "",
  "POSTHOG_API_KEY": ""
}
```

Use installed `codex plugin marketplace add --help` and `codex plugin add --help`
for the version-matched installation commands. Back up only configuration files
being changed, privately. Start a new Codex session after installation. This is
stdio with CEP file IPC; no HTTP or UXP listener is required. Unsafe scripting
remains disabled. Capabilities are authority checks, not a project-path sandbox.

## Verification, updates, and rollback

First verify MCP initialization, tool discovery, and denied capability calls.
Then inspect the Premiere connection and use only a disposable synthetic project
for an edit and readback. Package tests do not prove host compatibility. Record
the actual host version and verification result privately.

For updates, manually review another fork commit, repeat the build/tests/signing
in a new version directory, then replace the connector and `current` together
with Premiere closed and old MCP sessions stopped. Retain the previous version.
For rollback, restore its connector and point `current` back to that version,
then reopen Premiere and start a new Codex session. Removing the distinct plugin
registration and this connector disables the integration; do not remove shared
Adobe preferences or unrelated Codex registrations. Never schedule Git pulls or
install updates automatically.
