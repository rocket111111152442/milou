import { capturePage } from "./capture.js";
import { monitoringUrl } from "./monitoring-url.js";

const button = document.getElementById("capture");
const form = document.getElementById("paste");
const input = document.getElementById("page-url");
const status = document.getElementById("status");
const destination = "https://www.waverti.com/app/surveillances/nouvelle";
const pageTitle = document.getElementById("page-title");
const pageHost = document.getElementById("page-host");
const pageState = document.getElementById("page-state");

function showCurrentPage(tab) {
  const url = monitoringUrl(tab?.url);
  if (!url) {
    pageTitle.textContent = "Aucune page sélectionnée";
    pageHost.textContent = "Ouvre une fiche produit ou une page Web";
    pageState.textContent = "Prêt";
    return;
  }
  pageTitle.textContent = tab.title?.trim() || url.hostname;
  pageHost.textContent = url.hostname;
  pageState.textContent = "Page active";
}

document.getElementById("open-dashboard").addEventListener("click", () => {
  void chrome.tabs.create({ url: "https://www.waverti.com/app/surveillances" });
  window.close();
});

async function openWaverti(observation) {
  const fragment = encodeURIComponent(JSON.stringify(observation));
  await chrome.tabs.create({ url: destination + "#waverti-releve=" + fragment });
  window.close();
}

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "";
  pageState.textContent = "Lecture…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const link = tab?.url ? capturePage(tab.url, true) : null;
    if (!tab?.id || !link) {
      status.textContent = "Ouvre une page Web dans l’onglet actif ou colle son adresse ci-dessous.";
      return;
    }

    let reading = null;
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: capturePage,
      });
      reading = injection?.result ?? null;
    } catch {
      // Chrome may forbid script execution on a page whose URL can still be sent.
    }
    await openWaverti(reading ?? link);
  } catch {
    status.textContent = "Waverti n’a pas pu s’ouvrir. Réessaie.";
  } finally {
    button.disabled = false;
    if (pageState.textContent === "Lecture…") pageState.textContent = "Page active";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  const link = capturePage(input.value.trim(), true);
  if (!link) {
    status.textContent = "Colle une adresse HTTP ou HTTPS de 2 048 caractères maximum, sans identifiant ni mot de passe.";
    input.focus();
    return;
  }
  const submit = form.querySelector("button");
  submit.disabled = true;
  try {
    await openWaverti(link);
  } catch {
    status.textContent = "Waverti n’a pas pu s’ouvrir. Réessaie.";
  } finally {
    submit.disabled = false;
  }
});

const recurringStatus = document.getElementById("monitoring-status");
const sites = document.getElementById("authorized-sites");
const sitesSummary = document.querySelector("#sites-details summary");
document.getElementById("extension-version").textContent = "Extension Waverti " + chrome.runtime.getManifest().version;
const controls = Object.fromEntries(["pair", "verify-link", "poll", "enable", "pause", "authorize", "unlink"]
  .map((id) => [id, document.getElementById(id)]));
const actionErrors = new Map([
  ["server_update_required", "Le site Waverti doit être mis à jour pour relier Chrome. Le relevé ponctuel reste disponible."],
  ["rate_limited", "Trop de tentatives. Attends un peu avant de réessayer."],
  ["server_unavailable", "Le service Waverti est temporairement indisponible. Réessaie plus tard."],
  ["network", "Impossible de joindre Waverti. Vérifie ta connexion, puis réessaie."],
]);
let activeTab;
let activeTarget;
let device;

async function worker(type, options = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...options });
  if (!response?.ok) throw new Error(response?.error ?? "monitoring_action");
  return response.value;
}

function showDevice(state) {
  device = state;
  controls.pair.hidden = state.paired || state.pairing;
  controls["verify-link"].hidden = state.paired || !state.pairing;
  controls.poll.hidden = state.paired || !state.pairing;
  controls.enable.hidden = !state.paired || state.enabled;
  controls.pause.hidden = !state.paired || !state.enabled;
  controls.authorize.hidden = !state.enabled || !activeTarget;
  controls.unlink.hidden = !state.paired;
  recurringStatus.textContent = state.pairing
    ? "Code " + state.pairing.userCode + " · valide-le dans Waverti."
    : state.lastProblem || (state.enabled
    ? activeTarget
      ? "Contrôle actif · autorise cette page pour commencer."
      : "Contrôle actif · ouvre une page HTTPS pour l’autoriser."
    : state.paired
      ? "Navigateur relié · contrôles en pause."
      : "Relie ce navigateur pour commencer.");

  sites.replaceChildren();
  sitesSummary.textContent = state.sites.length ? `Pages autorisées · ${state.sites.length}` : "Pages autorisées";
  for (const site of state.sites) {
    const item = document.createElement("li");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = site.granted ? "Retirer · " + site.origin : "Oublier · " + site.origin;
    remove.addEventListener("click", () => void perform(remove, async () => {
      showDevice(await worker("removeSite", { site: site.origin }));
    }));
    item.append(remove);
    sites.append(item);
  }
}

async function perform(control, run) {
  control.disabled = true;
  try {
    await run();
  } catch (error) {
    try { showDevice(await worker("status")); } catch { /* Extension status unavailable. */ }
    recurringStatus.textContent = actionErrors.get(error?.message) ?? "Action impossible. Vérifie la liaison à Waverti, puis réessaie.";
  } finally {
    control.disabled = false;
  }
}

controls.pair.addEventListener("click", () => void perform(controls.pair, async () => showDevice(await worker("link"))));
controls["verify-link"].addEventListener("click", () => void perform(controls["verify-link"], async () => {
  if (device?.pairing?.verificationUrl) await chrome.tabs.create({ url: device.pairing.verificationUrl });
}));
controls.poll.addEventListener("click", () => void perform(controls.poll, async () => showDevice(await worker("poll"))));
controls.enable.addEventListener("click", () => void perform(controls.enable, async () => showDevice(await worker("enable", { enabled: true }))));
controls.pause.addEventListener("click", () => void perform(controls.pause, async () => showDevice(await worker("enable", { enabled: false }))));
controls.unlink.addEventListener("click", () => void perform(controls.unlink, async () => showDevice(await worker("unlink"))));
controls.authorize.addEventListener("click", () => void perform(controls.authorize, async () => {
  if (!device?.enabled || !activeTarget || !activeTab?.id) return;
  const granted = await chrome.permissions.request({ origins: [activeTarget.origin + "/*"] });
  if (!granted) {
    recurringStatus.textContent = "L’accès à ce site a été refusé. Aucun contrôle n’a été activé pour cette page.";
    return;
  }
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: capturePage,
    args: [null, false, activeTarget.href],
  });
  if (!injection?.result?.reading) {
    recurringStatus.textContent = "La page a changé ou bloque le relevé. Rouvre la fiche exacte et réessaie.";
    return;
  }
  const { url } = await worker("authorize", { url: activeTarget.href });
  await openWaverti({ ...injection.result.reading, url, recurring: true });
}));

void Promise.all([
  chrome.tabs.query({ active: true, currentWindow: true }),
  worker("status"),
]).then(([[tab], state]) => {
  activeTab = tab;
  activeTarget = monitoringUrl(tab?.url);
  showCurrentPage(tab);
  showDevice(state);
}, () => {
  showCurrentPage(null);
  recurringStatus.textContent = "L’état des contrôles récurrents est indisponible.";
});
