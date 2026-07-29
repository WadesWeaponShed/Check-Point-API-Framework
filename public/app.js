const loginForm = document.querySelector("#loginForm");
const loginCard = document.querySelector("#loginCard");
const workspace = document.querySelector("#workspace");
const loginStatus = document.querySelector("#loginStatus");
const output = document.querySelector("#output");
const authModeInputs = document.querySelectorAll('input[name="authMode"]');
const managementTypeInput = document.querySelector("#managementType");
const managementHostInput = loginForm.querySelector('input[name="host"]');
let sessionId = "";
let sessionDescription = null;

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    error.details = result;
    throw error;
  }
  return result;
}

function parseJson(text) {
  try { return JSON.parse(text || "{}"); }
  catch { throw new Error("Request body must be valid JSON."); }
}

function show(value) {
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function updateLoginFields() {
  const authMode = document.querySelector('input[name="authMode"]:checked')?.value || "password";
  managementHostInput.placeholder = managementTypeInput.value === "smart1-cloud"
    ? "sampletennet-com-randomdata.maas.checkpoint.com/e4a2f819-3b91-4c6d-921e-7f01a5b823e4/web-api"
    : "Hostname or IP Address";
  document.querySelectorAll(".mds-field").forEach((field) => field.classList.toggle("hidden", managementTypeInput.value !== "mds"));
  document.querySelectorAll(".password-field, .username-field").forEach((field) => field.classList.toggle("hidden", authMode !== "password"));
  document.querySelectorAll(".api-key-field").forEach((field) => field.classList.toggle("hidden", authMode !== "api-key"));
}

function renderSession() {
  document.querySelector("#connectionLabel").textContent = `Connected to ${sessionDescription.baseUrl} as ${sessionDescription.user}`;
  const available = Object.entries(sessionDescription.contexts).filter(([, value]) => value.available);
  document.querySelector("#contexts").innerHTML = Object.entries(sessionDescription.contexts).map(([name, value]) =>
    `<span class="${value.available ? "available" : "unavailable"}" title="${value.error || ""}">${name}: ${value.available ? "ready" : "unavailable"}</span>`
  ).join("");
  document.querySelectorAll(".context-select").forEach((select) => {
    select.innerHTML = available.map(([name]) => `<option value="${name}">${name}</option>`).join("");
  });
}

authModeInputs.forEach((input) => input.addEventListener("change", updateLoginFields));
managementTypeInput.addEventListener("change", updateLoginFields);
updateLoginFields();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  loginStatus.textContent = "Connecting…";
  loginStatus.className = "status-card connecting full-row";
  try {
    const managementType = form.get("managementType") || "sms";
    sessionDescription = await api("/api/login", {
      host: form.get("host"),
      port: form.get("port"),
      authMode: form.get("authMode"),
      username: form.get("username"),
      password: form.get("password"),
      apiKey: form.get("apiKey"),
      smart1Cloud: managementType === "smart1-cloud",
      mdsMode: managementType === "mds",
      domain: managementType === "mds" ? form.get("domain") : "",
      managementObjectName: managementType === "mds" ? form.get("managementObjectName") : "",
      ignoreTls: form.get("ignoreTls") === "on",
      largeEnvironmentMode: form.get("largeEnvironmentMode") === "on"
    });
    sessionId = sessionDescription.sessionId;
    loginStatus.textContent = "Connected.";
    loginStatus.className = "status-card connected full-row";
    loginCard.classList.add("hidden");
    workspace.classList.remove("hidden");
    renderSession();
    show(sessionDescription);
  } catch (error) {
    loginStatus.textContent = `Connection failed: ${error.message}`;
    loginStatus.className = "status-card error full-row";
    show(error.details || error.message);
  }
});

document.querySelector("#commandForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    show(await api("/api/command", {
      sessionId,
      context: form.get("context"),
      command: form.get("command"),
      body: parseJson(form.get("body"))
    }));
  } catch (error) { show(error.details || error.message); }
});

document.querySelector("#scriptForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    show("Waiting for run-script task…");
    show(await api("/api/run-script", {
      sessionId,
      context: form.get("context"),
      body: {
        "script-name": "api-framework-script",
        script: form.get("script"),
        targets: [form.get("target")]
      }
    }));
  } catch (error) { show(error.details || error.message); }
});

document.querySelector("#exampleButton").addEventListener("click", async () => {
  const context = document.querySelector("#commandForm [name=context]").value;
  try { show(await api("/api/example", { sessionId, context })); }
  catch (error) { show(error.details || error.message); }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  try { await api("/api/logout", { sessionId }); } catch {}
  sessionId = "";
  workspace.classList.add("hidden");
  loginCard.classList.remove("hidden");
  loginStatus.textContent = "Logged out.";
  loginStatus.className = "status-card disconnected full-row";
});

document.querySelector("#clearButton").addEventListener("click", () => show("Ready."));
