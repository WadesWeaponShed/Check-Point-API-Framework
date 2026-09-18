import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { apiUrl, normalizeBaseUrl } from "../src/check-point-client.js";
import { SessionManager } from "../src/session-manager.js";

test("normalizes SMS and Smart-1 Cloud API URLs", () => {
  assert.equal(normalizeBaseUrl("mgmt.example.com", "443"), "https://mgmt.example.com");
  assert.equal(
    normalizeBaseUrl("https://tenant.maas.checkpoint.com/customer/abc", "", { smart1Cloud: true }),
    "https://tenant.maas.checkpoint.com/customer/abc/web_api"
  );
  assert.equal(
    apiUrl({ baseUrl: "https://mgmt.example.com", smart1Cloud: false }, "show-hosts").pathname,
    "/web_api/show-hosts"
  );
});

test("creates MDS contexts, runs commands, polls run-script, and logs out", async (t) => {
  const requests = [];
  let loginCount = 0;
  let taskPolls = 0;
  class MockClient {
    constructor(options) {
      Object.assign(this, options);
    }
    withSid(sid) {
      return new MockClient({ ...this, sid });
    }
    async command(command, body = {}) {
      requests.push({ command, body, sid: this.sid || "" });
      let result;
      if (command === "login") result = { sid: `sid-${++loginCount}` };
      else if (command === "show-hosts") result = { objects: [{ name: "host-a" }], total: 1 };
      else if (command === "run-script") result = { tasks: [{ "task-id": "task-1" }] };
      else if (command === "show-task") {
        taskPolls += 1;
        result = taskPolls < 2
          ? { tasks: [{ "task-details": [] }] }
          : { tasks: [{ "task-details": [{ statusDescription: "R81.20" }] }] };
      } else result = { message: "OK" };
      return result;
    }
    async list(command, body = {}) {
      return (await this.command(command, body)).objects;
    }
  }

  const sessions = new SessionManager({
    taskPollAttempts: 3,
    taskPollIntervalMs: 1,
    clientFactory: (options) => new MockClient(options)
  });
  const connected = await sessions.login({
    host: "https://mds.example.com",
    authMode: "password",
    username: "admin",
    password: "secret",
    mdsMode: true,
    domain: "Domain-A"
  });

  assert.deepEqual(
    Object.fromEntries(Object.entries(connected.contexts).map(([key, value]) => [key, value.available])),
    { primary: true, mds: true, global: true, "system-data": true }
  );
  assert.equal(connected.largeEnvironmentMode, false);
  assert.equal(requests.filter(({ command }) => command === "login").length, 4);
  assert.equal(requests.find(({ body }) => body.domain === "Global").body.password, "secret");

  const objects = await sessions.list(connected.sessionId, "show-hosts", {}, "global");
  assert.equal(objects[0].name, "host-a");
  assert.equal(requests.find(({ command }) => command === "show-hosts").sid, "sid-3");

  const script = await sessions.runScript(connected.sessionId, {
    "script-name": "test",
    script: "show version",
    targets: ["gw"]
  }, "mds");
  assert.equal(script.output, "R81.20");
  assert.equal(requests.find(({ command }) => command === "run-script").sid, "sid-2");
  assert.equal(taskPolls, 2);

  const logout = await sessions.logout(connected.sessionId);
  assert.equal(logout.closedContexts, 4);
  assert.throws(() => sessions.get(connected.sessionId), /Session not found/);
});

test("large-environment mode applies separate API and run-script throttles", async () => {
  let activeApi = 0;
  let maxActiveApi = 0;
  let activeScripts = 0;
  let maxActiveScripts = 0;

  class ThrottleClient {
    constructor(options) { Object.assign(this, options); }
    withSid(sid) { return new ThrottleClient({ ...this, sid }); }
    async command(command) {
      if (command === "login") return { sid: "large-sid" };
      if (command === "logout") return { message: "OK" };
      const isScript = command === "run-script";
      if (isScript) {
        activeScripts += 1;
        maxActiveScripts = Math.max(maxActiveScripts, activeScripts);
      } else {
        activeApi += 1;
        maxActiveApi = Math.max(maxActiveApi, activeApi);
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (isScript) {
        activeScripts -= 1;
        return { tasks: [{ "task-details": [{ statusDescription: "done" }] }] };
      }
      activeApi -= 1;
      return { ok: true };
    }
  }

  const sessions = new SessionManager({
    largeEnvironmentApiConcurrency: 2,
    largeEnvironmentRunScriptConcurrency: 1,
    clientFactory: (options) => new ThrottleClient(options)
  });
  const connected = await sessions.login({
    host: "https://large.example.com",
    authMode: "password",
    username: "admin",
    password: "secret",
    largeEnvironmentMode: true
  });

  await Promise.all(Array.from({ length: 6 }, () =>
    sessions.command(connected.sessionId, "show-hosts")
  ));
  await Promise.all(Array.from({ length: 3 }, () =>
    sessions.runScript(connected.sessionId, { script: "show version", targets: ["gw"] })
  ));

  assert.equal(connected.largeEnvironmentMode, true);
  assert.equal(maxActiveApi, 2);
  assert.equal(maxActiveScripts, 1);
});

test("generated v2.1 command catalog includes categorized read and write commands", async () => {
  const catalog = JSON.parse(await readFile(
    new URL("../public/data/check-point-api-v2.1.json", import.meta.url),
    "utf8"
  ));
  const showHost = catalog.commands.find((command) => command.name === "show-host");
  const addHost = catalog.commands.find((command) => command.name === "add-host");

  assert.equal(catalog.apiVersion, "v2.1");
  assert.equal(catalog.commandCount, catalog.commands.length);
  assert.ok(catalog.commandCount >= 1000);
  assert.equal(showHost.category, "Network Objects / Host");
  assert.equal(showHost.readOnly, true);
  assert.equal(addHost.readOnly, false);
  assert.deepEqual(addHost.requestTemplate, { name: "", "ip-address": "" });
});

test("gateway run-script preset catalog separates monitoring from state-changing commands", async () => {
  const catalog = JSON.parse(await readFile(
    new URL("../public/data/gateway-run-script-presets.json", import.meta.url),
    "utf8"
  ));
  const status = catalog.presets.find((preset) => preset.id === "autoupdater-status");
  const disable = catalog.presets.find((preset) => preset.id === "autoupdater-disable-urgent");
  const revert = catalog.presets.find((preset) => preset.id === "cplp-revert");

  assert.equal(status.risk, "safe");
  assert.equal(status.script, "autoupdatercli status");
  assert.equal(disable.risk, "danger");
  assert.equal(revert.risk, "danger");
  assert.ok(catalog.presets.length >= 15);
});
