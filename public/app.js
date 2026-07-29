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
let commandCatalog = null;
let visibleCommands = [];

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

function selectedCatalogCommand() {
  const name = document.querySelector("#commandSelect").value;
  return commandCatalog?.commands.find((command) => command.name === name) || null;
}

function fieldSummary(field) {
  const alternatives = field.alternatives?.length ? ` or ${field.alternatives.join(", ")}` : "";
  return `${field.name}${alternatives} — ${field.type}`;
}

function renderCommandDetails({ resetBody = false } = {}) {
  const command = selectedCatalogCommand();
  const infoName = document.querySelector("#commandInfoName");
  const infoDescription = document.querySelector("#commandInfoDescription");
  const badges = document.querySelector("#commandBadges");
  const parameters = document.querySelector("#commandParameters");
  const warning = document.querySelector("#mutationWarning");
  badges.replaceChildren();
  parameters.replaceChildren();

  if (!command) {
    infoName.textContent = "No Matching Commands";
    infoDescription.textContent = "Change the category or search text to see commands.";
    warning.classList.add("hidden");
    return;
  }

  infoName.textContent = command.name;
  infoDescription.textContent = command.description || "No description is provided in the API reference.";
  const badgeValues = [
    command.category,
    command.readOnly ? "Read-Only" : "Changes State",
    command.deprecated ? "Deprecated" : ""
  ].filter(Boolean);
  for (const value of badgeValues) {
    const badge = document.createElement("span");
    badge.textContent = value;
    badge.className = value === "Changes State" ? "badge mutation" : "badge";
    badges.append(badge);
  }

  const groups = [
    ["Required", command.requiredFields],
    ["Optional", command.optionalFields]
  ];
  for (const [label, fields] of groups) {
    if (!fields?.length) continue;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${label} Parameters (${fields.length})`;
    details.append(summary);
    const list = document.createElement("ul");
    for (const field of fields) {
      const item = document.createElement("li");
      item.textContent = fieldSummary(field);
      item.title = field.description || "";
      list.append(item);
    }
    details.append(list);
    parameters.append(details);
  }
  warning.classList.toggle("hidden", command.readOnly);
  if (resetBody) {
    document.querySelector('#commandForm textarea[name="body"]').value =
      JSON.stringify(command.requestTemplate || {}, null, 2);
  }
}

function renderCommandOptions({ preserveSelection = true } = {}) {
  if (!commandCatalog) return;
  const select = document.querySelector("#commandSelect");
  const previous = preserveSelection ? select.value : "";
  const category = document.querySelector("#commandCategory").value;
  const search = document.querySelector("#commandSearch").value.trim().toLowerCase();
  visibleCommands = commandCatalog.commands.filter((command) =>
    (!category || command.category === category) &&
    (!search || `${command.name} ${command.description}`.toLowerCase().includes(search))
  );
  select.replaceChildren();
  for (const command of visibleCommands) {
    const option = document.createElement("option");
    option.value = command.name;
    option.textContent = `${command.name}${command.readOnly ? "" : " ⚠"}`;
    select.append(option);
  }
  if (visibleCommands.some((command) => command.name === previous)) select.value = previous;
  else if (visibleCommands.some((command) => command.name === "show-gateways-and-servers")) {
    select.value = "show-gateways-and-servers";
  }
  renderCommandDetails({ resetBody: true });
}

async function loadCommandCatalog() {
  const status = document.querySelector("#catalogStatus");
  try {
    const response = await fetch("/data/check-point-api-v2.1.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    commandCatalog = await response.json();
    const categorySelect = document.querySelector("#commandCategory");
    for (const category of commandCatalog.categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categorySelect.append(option);
    }
    status.textContent = `${commandCatalog.commandCount.toLocaleString()} commands from the Check Point Management API ${commandCatalog.apiVersion} reference.`;
    renderCommandOptions({ preserveSelection: false });
  } catch (error) {
    status.textContent = `Command catalog could not be loaded: ${error.message}`;
  }
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
document.querySelector("#commandCategory").addEventListener("change", () => renderCommandOptions());
document.querySelector("#commandSearch").addEventListener("input", () => renderCommandOptions());
document.querySelector("#commandSelect").addEventListener("change", () => renderCommandDetails({ resetBody: true }));
void loadCommandCatalog();

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
    const command = selectedCatalogCommand();
    if (command && !command.readOnly) {
      const confirmed = window.confirm(
        `${command.name} can change management state. Run this command with the current request body?`
      );
      if (!confirmed) return;
    }
    const path = form.get("command") === "run-script" ? "/api/run-script" : "/api/command";
    show(await api(path, {
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
