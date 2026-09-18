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
- A searchable, categorized catalog of documented Management API v2.1 commands
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

Refresh the committed command catalog from Check Point's current v2.1 reference:

```bash
npm run catalog:update
```

The generated catalog is stored at `public/data/check-point-api-v2.1.json`. It is
loaded locally by the browser; the application does not scrape the documentation
site at runtime.

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
