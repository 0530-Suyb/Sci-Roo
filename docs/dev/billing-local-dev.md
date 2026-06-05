# Activation Code Local Dev

This guide covers the current premium flow in the extension: `local trial + local activation code`.

This is the default premium path right now. The website billing code still exists in the repository, but it is being kept as a future server-backed scaffold and does not control the active unlock flow.

There is no required billing website in this mode. The extension runs on its own and stores activation state in VS Code global state on the current device.

## What this gives you

With the local activation flow enabled, the extension can exercise:

- automatic local trial start
- premium feature gating by tier
- activation code entry from the command palette or locked views
- local activation reset for repeated testing

## Launch the extension

From VS Code, press `F5` and choose:

```text
Run Extension
```

That launch flow builds both:

- the extension backend bundle
- the webview static bundle

so the latest activation UI is included on first run.

## Relationship to website billing code

The repository still contains:

- `apps/web-roo-code/src/lib/billing/*`
- `docs/dev/billing-api.md`
- extension-facing billing API shapes and mocks

Those files are intentionally retained so we can later reconnect the extension to a real website payment backend. They are not the default unlock path today.

## Test the premium flow

In the Extension Development Host:

1. Open one of these premium features:
    - `Research Pipeline (Plus)`
    - `Read Paper (Plus)`
    - `Paper Writing (Pro)`
    - `Data Studio (Max)`
2. On the first premium action from a free state, the extension should start the local trial automatically.
3. After the trial ends, or if the current tier is too low, the locked view should prompt for an activation code.

## Activation code whitelist

The local validator now uses a fixed whitelist. Only these codes unlock access:

```text
PLUS-DEMO-2026
PRO-DEMO-2026
MAX-DEMO-2026
SCI-PLUS-DEMO-2026
SCI-PRO-DEMO-2026
SCI-MAX-DEMO-2026
```

Tier rules:

- `PLUS` unlocks `Research Pipeline` and `Read Paper`
- `PRO` also unlocks `Paper Writing`
- `MAX` also unlocks `Data Studio`

## Useful commands

From the command palette:

- `输入激活码` / `Enter Activation Code`
- `清除激活码` / `Clear Activation Code`
- `重置试用状态` / `Reset Trial State`
- `刷新权限状态` / `Refresh Access State`

`Clear Activation Code` is useful when you want to re-test activation behavior.  
`Reset Trial State` is useful when you want to re-test the local trial duration.

## Notes

- Trial state and activation state are stored locally on the current device.
- This is intentionally a plugin-first implementation so the extension flow can be tested before a real server exists.
- The next step can later replace local activation validation with a server-backed check without changing the premium gating UI very much.
