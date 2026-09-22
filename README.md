# Check Point API Framework

A neutral Node.js starter for applications built on the Check Point Management API. It provides reusable connection, session-context, command, and script-execution layers without application-specific business logic.

## What the framework handles

- Security Management Server (SMS)
- Smart-1 Cloud context URLs and `/web_api` path normalization
- Multi-Domain Server (MDS) sessions
  - selected Domain/CMA (`primary`)
  - MDS (`mds`)
  - Global Domain (`global`)
  - System Data (`system-data`)
- Username/password and API-key authentication
- Self-signed TLS certificates when explicitly enabled
- Generic Management API commands
- Searchable, versioned Management API catalogs (v2.1 and v2.2 bundled)
- Starter JSON bodies and parameter metadata from the official API reference
- Confirmation warnings before commands that can change management state
- Automatic pagination for `show-*` collection commands
- Concurrent, queued `run-script` execution
- `show-task` polling and Gaia output decoding
- Gateway Live Patch and AutoUpdater `run-script` presets, categorized by monitoring or state-changing risk
- Best-effort logout of every Check Point session

There is intentionally no product-specific evaluation, remediation, reporting, or audit-history logic.

## Run it

Requires Node.js 18 or newer. There are no third-party runtime dependencies.

```bash
npm start
```

Open `http://127.0.0.1:3000`.

Run the syntax checks and tests:

```bash
npm run check
```

## Using an AI Coding Agent

This project includes explicit guardrails for Codex, Claude Code, Gemini CLI, and other coding agents. Before asking an agent to change the framework, tell it to read these files **in this order**:

1. [`AGENTS.md`](AGENTS.md) — required framework contracts and completion checks
2. [`README.md`](README.md) — setup, boundaries, and local API
3. [`docs/architecture.md`](docs/architecture.md) — SMS, Smart-1 Cloud, MDS, contexts, sessions, and task lifecycle
4. [`docs/adding-workflows.md`](docs/adding-workflows.md) — how to build an application without changing the base plumbing
5. [`docs/gaia-run-script-presets.md`](docs/gaia-run-script-presets.md) — how to safely add Gaia/run-script commands
6. `src/check-point-client.js`, `src/session-manager.js`, `src/server.js`, and `test/framework.test.js`

Suggested prompt:

> Read `AGENTS.md` and every file listed under “Using an AI Coding Agent” before changing this repository. Preserve the SMS, Smart-1 Cloud, and MDS login/session contracts. Build the requested application behavior as a workflow or UI extension; do not bypass SessionManager, task polling, throttling, or the existing command safeguards. Run `npm run check` before you finish.

The agent instructions are intentionally framework-focused: they allow application-specific work while protecting login, context selection, generic commands, Gaia task execution, and large-environment handling.

Refresh the committed command catalog from Check Point's current v2.1 reference:

```bash
npm run catalog:update
```

This command regenerates the bundled v2.1 catalog. Use `-- --version v2.2` for v2.2.
Catalogs are generated from official documentation; do not hand-edit them.

### Catalog Updates and Compatibility

**Catalog Update Details** compares the selected API catalog with the preceding installed version (for example, v2.1 → v2.2), listing added, removed, changed and newly deprecated command names even when no update is available. This is a comparison of downloaded command metadata, not the full vendor changelog. The update status separately reports changes since your last download; empty update arrays mean that your installed copy already matches the published data.

The update button shows progress and a visible result: **Already up to date**, the API version(s) added, existing catalogs refreshed, or an error with the cached catalogs retained. A new version message is shown only after successful installation. Expand **Catalog Update Details** for individual command changes.

After login, use **Check for Updates** in API Command Explorer to download all published API versions, validate them, and show added, removed, changed and newly deprecated commands. Existing catalogs remain usable if a download fails. `npm run catalog:sync` performs the same update without a management login. Internet access to `sc1.checkpoint.com` is needed only for these updates.

Updates are cached in `.catalog-cache/` (ignored by Git); each catalog is replaced by an atomic rename and its preceding version is kept as `.previous`. Valid cached catalogs load on restart, with bundled catalogs as a fallback. This updates command data, not application code or Check Point servers. Fresh clones include v2.1 and v2.2; run an update to obtain older versions.

Set `CATALOG_AUTO_UPDATE=true` to update at server startup and every 24 hours while it is running. The default is manual updates. Automatic updates do not switch an open form's selected version or execute commands; reload the catalog to see new data.

The explorer queries `show-api-versions` for the selected context, chooses the highest installed version advertised by that context, and uses explicit `/web_api/vX.Y/command` requests. Other catalogs are browsable, but cannot execute through the explorer unless support is advertised. If discovery fails, the explorer stays browse-only; existing unversioned workflows and Gaia form behavior remain available. Version support does not guarantee permissions, allowed domain type, platform or gateway prerequisites.

Command badges show the selected catalog and earliest downloaded version containing the command, not an unverified introduction date. Official API-to-release mappings include v2.1 → R82.10 and v2.2 → R82.20. These are API release associations, not claims that every command works on that release and all earlier releases. Unknown mappings are explicitly unverified. Gaia shell presets still require separate target release/platform/hotfix verification.

Local catalog endpoints: `POST /api/catalog/status`, `/api/catalog/get` with `version`, `/api/catalog/update` with an active `sessionId`, and `/api/capabilities` with `sessionId` and `context`. Versioned command/run-script requests accept `apiVersion`; SessionManager rejects versions not advertised by that context. All management calls retain existing throttling.

Useful environment variables:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `HOST` | `127.0.0.1` | Local listening address |
| `PORT` | `3000` | Local listening port |
| `RUN_SCRIPT_CONCURRENCY` | `8` | Maximum simultaneous Gaia scripts |
| `LARGE_ENV_RUN_SCRIPT_CONCURRENCY` | `3` | Gaia script concurrency in large-environment mode |
| `LARGE_ENV_API_CONCURRENCY` | `10` | Management API concurrency in large-environment mode |
| `TASK_POLL_ATTEMPTS` | `20` | Maximum `show-task` polls |
| `TASK_POLL_INTERVAL_MS` | `1000` | Delay between task polls |
| `LARGE_ENV_TASK_POLL_INTERVAL_MS` | `1250` | Task-poll delay in large-environment mode |
| `CP_API_LOGGING` | unset | Enable redacted Check Point request logging |

## Where to build your application

### Coding Agent Design Guidance

For UI changes, have your agent read these files after `AGENTS.md`:

- [`DESIGN.md`](DESIGN.md): approved colors, typography, layout, and responsive rules.
- [`docs/design-patterns.md`](docs/design-patterns.md): login, navigation, forms, results, and interaction states.
- [`skills/framework-design/SKILL.md`](skills/framework-design/SKILL.md): reusable design workflow for coding agents.

Suggested prompt:

> Read AGENTS.md, DESIGN.md, docs/design-patterns.md, and skills/framework-design/SKILL.md. Extend the approved workbench style for this feature. Preserve all management types, contexts, confirmations, and per-gateway output. Verify desktop, mobile, and keyboard behavior, then run npm run check.

The bundled skill is ordinary Markdown with skill frontmatter. Any coding agent can read it by path; automatic discovery varies by coding app. For apps supporting local skill installation, use `skills/framework-design/` and keep the repository's design documents available. No external plugin, font service, or original author's machine is required. Project-specific design guidance takes precedence over generic aesthetic defaults unless you request a redesign.

`public/workbench.css` extends the base styles. `public/workbench.js` arranges existing forms into navigation and content areas while retaining their event handlers. Load these after `styles.css` and `app.js`, respectively. The design mock is historical sample data; the main app performs real API calls.

Put application-specific collection and business logic in `src/workflows/`. The included `example.js` lists gateway/server objects and demonstrates the intended boundary:

```js
export async function runMyWorkflow({ sessions, sessionId }) {
  const gateways = await sessions.list(
    sessionId,
    "show-gateways-and-servers",
    {},
    "primary"
  );

  const version = await sessions.runScript(sessionId, {
    "script-name": "get-version",
    script: 'clish -c "show version all"',
    targets: [gateways[0].name]
  });

  return { gateways, version };
}
```

Keep reusable connection behavior in:

- `src/check-point-client.js` — transport, URLs, errors, pagination
- `src/session-manager.js` — authentication contexts, sessions, task polling
- `src/server.js` — local HTTP routes and static app

The browser UI is deliberately an API explorer. Once a new workflow is established, replace the explorer in `public/` with that application's interface.

## Local API

All routes except health use JSON `POST` requests.

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Local server health |
| `POST /api/login` | Create the applicable Check Point contexts |
| `POST /api/session` | Describe available contexts without exposing SIDs |
| `POST /api/command` | Run any Management API command |
| `POST /api/list` | Run a paginated collection command |
| `POST /api/run-script` | Run a Gaia script and poll its task |
| `POST /api/example` | Execute the replaceable example workflow |
| `POST /api/logout` | Close all available Check Point sessions |

For MDS `run-script` calls targeting MDS-managed objects, pass `"context": "mds"`. Domain object API calls normally use `"primary"`. Global assignment data can use `"global"`, and system-wide configuration can use `"system-data"` when that login is available.

## Security notes

This is a development framework, not a production-ready authentication boundary. Sessions and SIDs are held only in server memory, but the generic command route lets a connected operator invoke any command their Check Point account permits. Before exposing the app beyond localhost, add your own user authentication, authorization/command allowlists, CSRF protection, rate limiting, secure secret handling, and an HTTPS reverse proxy.
