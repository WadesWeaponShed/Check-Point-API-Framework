import { randomUUID } from "node:crypto";
import { CheckPointClient, normalizeBaseUrl } from "./check-point-client.js";

const CONTEXTS = new Set(["primary", "mds", "global", "system-data"]);

function enabled(value) {
  return value === true || value === "true" || value === "on";
}

function loginBody(payload, domain) {
  const authMode = payload.authMode === "api-key" ? "api-key" : "password";
  const body = {};
  if (authMode === "api-key") {
    if (!payload.apiKey) throw new Error("API key is required.");
    body["api-key"] = String(payload.apiKey);
  } else {
    if (!payload.username) throw new Error("Username is required.");
    if (!payload.password) throw new Error("Password is required.");
    body.user = String(payload.username);
    body.password = String(payload.password);
  }
  if (domain) body.domain = String(domain);
  return body;
}

function taskIds(result) {
  return [...new Set((result?.tasks || [])
    .map((task) => task?.["task-id"] || task?.taskId || task?.uid)
    .filter(Boolean))];
}

function taskOutput(result) {
  const details = (result?.tasks || []).flatMap((task) => task?.["task-details"] || task?.taskDetails || []);
  const descriptions = details
    .map((detail) => detail?.statusDescription || detail?.["status-description"])
    .filter(Boolean)
    .map(String);
  const messages = details
    .map((detail) => detail?.responseMessage || detail?.["response-message"])
    .filter(Boolean)
    .map((value) => {
      try { return Buffer.from(String(value), "base64").toString("utf8").trim(); } catch { return ""; }
    })
    .filter(Boolean);
  return [...descriptions, ...messages].join("\n");
}

function createLimiter(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    const { work, resolve, reject } = queue.shift();
    active += 1;
    Promise.resolve().then(work).then(resolve, reject).finally(() => {
      active -= 1;
      next();
    });
  };
  return (work) => new Promise((resolve, reject) => {
    queue.push({ work, resolve, reject });
    next();
  });
}

export class SessionManager {
  constructor({
    logger = null,
    runScriptConcurrency = 8,
    largeEnvironmentRunScriptConcurrency = 3,
    largeEnvironmentApiConcurrency = 10,
    taskPollAttempts = 20,
    taskPollIntervalMs = 1000,
    largeEnvironmentTaskPollIntervalMs = 1250,
    clientFactory = (options) => new CheckPointClient(options)
  } = {}) {
    this.sessions = new Map();
    this.logger = logger;
    this.taskPollAttempts = taskPollAttempts;
    this.taskPollIntervalMs = taskPollIntervalMs;
    this.largeEnvironmentTaskPollIntervalMs = largeEnvironmentTaskPollIntervalMs;
    this.clientFactory = clientFactory;
    this.runQueued = createLimiter(runScriptConcurrency);
    this.largeEnvironmentRunQueued = createLimiter(largeEnvironmentRunScriptConcurrency);
    this.largeEnvironmentApiQueued = createLimiter(largeEnvironmentApiConcurrency);
  }

  async login(payload) {
    const smart1Cloud = enabled(payload.smart1Cloud);
    const mdsMode = enabled(payload.mdsMode) || enabled(payload.mdsScan);
    const largeEnvironmentMode = enabled(payload.largeEnvironmentMode);
    const baseUrl = normalizeBaseUrl(payload.host, payload.port, { smart1Cloud });
    const baseClient = this.clientFactory({
      baseUrl,
      smart1Cloud,
      rejectUnauthorized: !enabled(payload.ignoreTls),
      logger: this.logger
    });
    const primaryLogin = await baseClient.command("login", loginBody(payload, payload.domain));
    if (!primaryLogin.sid) throw new Error(primaryLogin.message || "Login did not return a session ID.");

    const sids = { primary: primaryLogin.sid, mds: "", global: "", "system-data": "" };
    const contextErrors = {};
    const optionalLogin = async (context, domain) => {
      try {
        const result = await baseClient.command("login", loginBody(payload, domain));
        if (!result.sid) throw new Error(`${domain} login did not return a session ID.`);
        sids[context] = result.sid;
      } catch (error) {
        contextErrors[context] = error.message;
      }
    };

    if (mdsMode) {
      if (payload.domain) await optionalLogin("mds", "");
      else sids.mds = primaryLogin.sid;
      await optionalLogin("global", "Global");
    }
    await optionalLogin("system-data", "System Data");

    const id = randomUUID();
    const session = {
      id,
      baseClient,
      sids,
      contextErrors,
      smart1Cloud,
      mdsMode,
      largeEnvironmentMode,
      domain: String(payload.domain || ""),
      managementObjectName: String(payload.managementObjectName || ""),
      user: payload.authMode === "api-key" ? "API Key" : String(payload.username),
      createdAt: new Date().toISOString()
    };
    this.sessions.set(id, session);
    return this.describe(session);
  }

  get(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error("Session not found. Log in again.");
    return session;
  }

  client(id, context = "primary") {
    if (!CONTEXTS.has(context)) throw new Error(`Unknown session context: ${context}.`);
    const session = this.get(id);
    const sid = session.sids[context];
    if (!sid) throw new Error(session.contextErrors[context] || `${context} session is not available.`);
    return session.baseClient.withSid(sid);
  }

  describe(sessionOrId) {
    const session = typeof sessionOrId === "string" ? this.get(sessionOrId) : sessionOrId;
    return {
      sessionId: session.id,
      user: session.user,
      baseUrl: session.baseClient.baseUrl,
      smart1Cloud: session.smart1Cloud,
      mdsMode: session.mdsMode,
      largeEnvironmentMode: session.largeEnvironmentMode,
      domain: session.domain,
      managementObjectName: session.managementObjectName,
      contexts: Object.fromEntries(Object.entries(session.sids).map(([name, sid]) => [name, {
        available: Boolean(sid),
        error: session.contextErrors[name] || ""
      }]))
    };
  }

  command(id, command, body = {}, context = "primary") {
    if (!command || !/^[a-z0-9][a-z0-9-]*$/i.test(command)) throw new Error("A valid API command is required.");
    const session = this.get(id);
    const work = () => this.client(id, context).command(command, body);
    return session.largeEnvironmentMode ? this.largeEnvironmentApiQueued(work) : work();
  }

  list(id, command, body = {}, context = "primary") {
    const session = this.get(id);
    const work = () => this.client(id, context).list(command, body);
    return session.largeEnvironmentMode ? this.largeEnvironmentApiQueued(work) : work();
  }

  runScript(id, body, context = "primary") {
    const session = this.get(id);
    const queue = session.largeEnvironmentMode ? this.largeEnvironmentRunQueued : this.runQueued;
    return queue(async () => {
      const client = this.client(id, context);
      const initial = await client.command("run-script", body);
      if (taskOutput(initial)) return { result: initial, output: taskOutput(initial) };
      const ids = taskIds(initial);
      if (ids.length === 0) return { result: initial, output: "" };

      let lastResult = initial;
      for (let attempt = 0; attempt < this.taskPollAttempts; attempt += 1) {
        const results = await Promise.all(ids.map((taskId) => client.command("show-task", {
          "task-id": taskId,
          "details-level": "full"
        })));
        lastResult = results[0] || lastResult;
        const completed = results.find((result) => taskOutput(result));
        if (completed) return { result: completed, output: taskOutput(completed) };
        if (attempt < this.taskPollAttempts - 1) {
          const interval = session.largeEnvironmentMode
            ? this.largeEnvironmentTaskPollIntervalMs
            : this.taskPollIntervalMs;
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
      return { result: lastResult, output: taskOutput(lastResult) };
    });
  }

  async logout(id) {
    const session = this.get(id);
    const uniqueSids = [...new Set(Object.values(session.sids).filter(Boolean))];
    const results = await Promise.allSettled(uniqueSids.map((sid) => session.baseClient.withSid(sid).command("logout")));
    this.sessions.delete(id);
    return { ok: true, closedContexts: uniqueSids.length, failures: results.filter((item) => item.status === "rejected").length };
  }
}
