import { capturePage } from "./capture.js";
import { monitoringHash, monitoringUrl } from "./monitoring-url.js";

const origin = "https://www.waverti.com";
const consentVersion = "chrome-monitoring-v1";
const alarmName = "waverti-browser-monitoring";
const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const hashPattern = /^[a-f\d]{64}$/;
const version = chrome.runtime.getManifest().version;
let tickRunning = false;
let actionQueue = Promise.resolve();

function action(fn) {
  const result = actionQueue.then(fn);
  actionQueue = result.catch(() => {});
  return result;
}

async function api(path, data, token) {
  let response;
  try {
    response = await fetch(origin + "/api/agent/" + path, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new Error("network");
  }
  if (!response.ok) {
    let code = response.status === 429 ? "rate_limited" : response.status >= 500 ? "server_unavailable" : "waverti_api";
    if (path === "link/start" && response.status === 422) {
      const body = await response.json().catch(() => null);
      if (body?.error === "validation_error" && Array.isArray(body.issues) && body.issues.some((issue) => issue?.path === "platform")) {
        code = "server_update_required";
      }
    }
    const error = new Error(code);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function state() {
  const local = await chrome.storage.local.get(["deviceToken", "enabled", "targets"]);
  const session = await chrome.storage.session.get(["pairing", "lastProblem"]);
  return { ...local, ...session, targets: Array.isArray(local.targets) ? local.targets : [] };
}

async function ensureAlarm() {
  const current = await state();
  if (current.pairing || (current.deviceToken && current.enabled)) {
    if (!await chrome.alarms.get(alarmName)) await chrome.alarms.create(alarmName, { periodInMinutes: 1 });
  } else {
    await chrome.alarms.clear(alarmName);
  }
}

async function publicState() {
  const current = await state();
  const sites = [...new Set(current.targets.map((entry) => entry.origin))];
  const pairing = current.pairing && current.pairing.expiresAt > Date.now() ? current.pairing : null;
  return {
    paired: Boolean(current.deviceToken),
    enabled: Boolean(current.deviceToken && current.enabled),
    pairing: pairing ? { userCode: pairing.userCode, verificationUrl: pairing.verificationUrl } : null,
    sites: await Promise.all(sites.map(async (site) => ({ origin: site, granted: await allowedPermission(site) }))),
    lastProblem: current.lastProblem ?? null,
  };
}

async function pollLink() {
  const { pairing } = await state();
  if (!pairing) return;
  if (pairing.expiresAt <= Date.now()) {
    await chrome.storage.session.remove("pairing");
    return;
  }
  let result;
  try {
    result = await api("link/poll", { deviceCode: pairing.deviceCode });
  } catch (error) {
    if (error.status !== 404) throw error;
    await chrome.storage.session.remove("pairing");
    return;
  }
  if (result.status === "approved" && /^wly_dev_[\w-]{32,180}$/.test(result.deviceToken ?? "")) {
    await chrome.storage.local.set({ deviceToken: result.deviceToken, enabled: false, targets: [] });
    await chrome.storage.session.remove(["pairing", "lastProblem"]);
  } else if (["expired", "invalid", "consumed", "denied"].includes(result.status)) {
    await chrome.storage.session.remove("pairing");
  }
}

async function beginLink() {
  const current = await state();
  if (current.deviceToken || current.pairing?.expiresAt > Date.now()) return;
  const result = await api("link/start", {
    deviceName: "Waverti — navigateur Chrome",
    platform: "chrome",
    appVersion: version,
  });
  const verification = new URL(result.verificationUrl);
  if (verification.origin !== origin || verification.pathname !== "/app/appareils/lier" || verification.username || verification.password ||
      !/^[A-Z\d]{4}-[A-Z\d]{4}$/.test(result.userCode ?? "") || verification.searchParams.get("code") !== result.userCode ||
      !/^[\w-]{32,128}$/.test(result.deviceCode ?? "") || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0) {
    throw new Error("invalid_link");
  }
  await chrome.storage.session.set({
    pairing: {
      deviceCode: result.deviceCode,
      userCode: result.userCode,
      verificationUrl: verification.href,
      expiresAt: Date.now() + Math.min(600, result.expiresIn) * 1000,
    },
  });
  await ensureAlarm();
}

async function setEnabled(enabled) {
  const { deviceToken } = await state();
  if (!deviceToken) throw new Error("not_linked");
  if (!enabled) await chrome.storage.local.set({ enabled: false });
  await api("consent", { accepted: enabled, consentVersion }, deviceToken);
  if (enabled) await chrome.storage.local.set({ enabled: true });
  await chrome.storage.session.remove("lastProblem");
  await ensureAlarm();
}

async function allowedPermission(site) {
  return chrome.permissions.contains({ origins: [site + "/*"] });
}

async function authorize(value) {
  const url = monitoringUrl(value);
  const current = await state();
  if (!current.deviceToken || !current.enabled || !url || !await allowedPermission(url.origin)) throw new Error("not_authorized");
  const hash = await monitoringHash(url);
  if (!current.targets.some((entry) => entry.hash === hash)) {
    if (current.targets.length >= 100) throw new Error("limit");
    await chrome.storage.local.set({ targets: [...current.targets, { hash, origin: url.origin }] });
  }
  return { url: url.href };
}

async function removeSite(site) {
  const { targets } = await state();
  if (!targets.some((entry) => entry.origin === site)) return;
  await chrome.storage.local.set({ targets: targets.filter((entry) => entry.origin !== site) });
  if (site !== origin) await chrome.permissions.remove({ origins: [site + "/*"] });
}

async function unlink() {
  const current = await state();
  await chrome.storage.local.set({ enabled: false });
  if (current.deviceToken) {
    try {
      await api("logout", {}, current.deviceToken);
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }
  await chrome.storage.local.remove(["deviceToken", "enabled", "targets"]);
  await chrome.storage.session.remove(["pairing", "lastProblem"]);
  await Promise.all([...new Set(current.targets.map((entry) => entry.origin))]
    .filter((site) => site !== origin)
    .map((site) => chrome.permissions.remove({ origins: [site + "/*"] })));
  await ensureAlarm();
}

function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(false), 15_000);
    function finish(ok) {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(updated);
      chrome.tabs.onRemoved.removeListener(removed);
      if (ok) resolve();
      else reject(new Error("navigation_unverified"));
    }
    function updated(id, change) {
      if (id === tabId && change.status === "complete") finish(true);
    }
    function removed(id) {
      if (id === tabId) finish(false);
    }
    chrome.tabs.onUpdated.addListener(updated);
    chrome.tabs.onRemoved.addListener(removed);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete" && !tab.pendingUrl) finish(true);
    }, () => finish(false));
  });
}

async function closeTemporaryTab() {
  const { temporaryTab } = await chrome.storage.session.get("temporaryTab");
  if (Number.isInteger(temporaryTab)) await chrome.tabs.remove(temporaryTab).catch(() => {});
  await chrome.storage.session.remove("temporaryTab");
}

function problem(code) {
  const messages = {
    access_restricted: "La page demande une connexion ou bloque le contrôle automatique.",
    navigation_unverified: "La page chargée n’a pas pu être confirmée.",
    page_changed: "La page a redirigé vers une autre adresse.",
    unsupported_rule: "Ce contrôle utilise un sélecteur ou un mode non pris en charge.",
    site_not_allowed: "Cette page n’est plus autorisée dans Chrome.",
    no_product_signal: "Aucun prix ni stock fiable n’a été détecté.",
  };
  return { code: Object.hasOwn(messages, code) ? code : "browser_check_failed", message: messages[code] ?? "Le relevé dans Chrome a échoué." };
}

async function isAuthorized(url, hash, token) {
  const current = await state();
  return current.enabled && current.deviceToken === token &&
    current.targets.some((entry) => entry.hash === hash && entry.origin === url.origin) &&
    await allowedPermission(url.origin);
}

async function readJob(job, url, hash, token) {
  if (job.task.kind !== "page" || job.task.renderMode !== "browser" || job.task.cssSelector) {
    return { error: problem("unsupported_rule") };
  }
  if (!await isAuthorized(url, hash, token)) return { error: problem("site_not_allowed") };

  const tab = await chrome.tabs.create({ active: false, url: url.href });
  if (!Number.isInteger(tab.id)) return { error: problem("navigation_unverified") };
  try {
    await chrome.storage.session.set({ temporaryTab: tab.id });
    await waitForLoad(tab.id);
    const capture = async () => {
      const loaded = await chrome.tabs.get(tab.id);
      if (monitoringUrl(loaded.url)?.href !== url.href) return { error: "page_changed" };
      if (loaded.status !== "complete" || loaded.pendingUrl) return { error: "navigation_unverified" };
      if (!await isAuthorized(url, hash, token)) return { error: "site_not_allowed" };
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: capturePage,
        args: [null, false, url.href],
      });
      const result = injection?.result;
      if (result?.error) return result;
      if (monitoringUrl(result?.loadedUrl)?.href !== url.href) return { error: "page_changed" };
      return result;
    };
    let result = await capture();
    if (result.reading?.price === null && result.reading.availability === "unknown") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      result = await capture();
    }
    if (result.error) return { error: problem(result.error) };
    const reading = result?.reading;
    if (!reading || (reading.price === null && reading.availability === "unknown")) {
      return { error: problem("no_product_signal") };
    }
    const jsonld = result.source === "jsonld";
    const source = jsonld ? "browser_product_jsonld" : "browser_buy_box";
    const evidence = (present) => ({
      status: present ? "verified" : "unavailable",
      sources: present ? [source] : [],
      checkedAt: reading.observedAt,
    });
    return { observation: {
      kind: "page",
      url: job.task.url,
      finalUrl: url.href,
      httpStatus: result.httpStatus,
      title: null,
      price: reading.price,
      currency: reading.currency,
      priceSource: reading.price === null ? null : result.source,
      availability: reading.availability,
      availabilitySource: reading.availability === "unknown" ? "none" : jsonld ? "jsonld" : "text",
      textHash: emptyHash,
      textLength: 0,
      excerpt: "",
      selectorFound: null,
      method: "browser",
      contentKind: "html",
      fetchedAt: reading.observedAt,
      fieldEvidence: {
        price: evidence(reading.price !== null),
        availability: evidence(reading.availability !== "unknown"),
      },
    } };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
    await chrome.storage.session.remove("temporaryTab");
  }
}

async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    await closeTemporaryTab();
    await action(pollLink);
    const current = await state();
    const token = current.deviceToken;
    if (!token || !current.enabled) return;
    const heartbeat = await api("heartbeat", { state: "idle", runningJobs: 0, appVersion: version }, token);
    if (!heartbeat.monitoringEnabled || !heartbeat.consent) {
      await chrome.storage.local.set({ enabled: false });
      return;
    }
    const targets = await Promise.all(current.targets.slice(0, 100).map(async (entry) =>
      hashPattern.test(entry.hash) && await allowedPermission(entry.origin) ? entry.hash : null));
    const urlHashes = targets.filter(Boolean);
    if (!urlHashes.length) return;
    const claim = await api("jobs/claim", { max: 1, urlHashes }, token);
    const job = claim.jobs?.[0];
    if (!job || !uuid.test(job.jobId) || !uuid.test(job.claimToken) || !(Date.parse(job.leaseExpiresAt) > Date.now())) return;
    const url = monitoringUrl(job.task?.url);
    if (!url) return;
    const hash = await monitoringHash(url);
    if (!urlHashes.includes(hash)) return;
    const started = Date.now();
    const result = await readJob(job, url, hash, token).catch(() => ({ error: problem("browser_check_failed") }));
    if (!await isAuthorized(url, hash, token)) return;
    await api("jobs/" + job.jobId + "/result", {
      claimToken: job.claimToken,
      durationMs: Math.min(600_000, Date.now() - started),
      ...result,
    }, token);
    if (result.error) await chrome.storage.session.set({ lastProblem: result.error.message });
    else await chrome.storage.session.remove("lastProblem");
  } catch (error) {
    if (error.status === 401) await chrome.storage.local.remove(["deviceToken", "enabled", "targets"]);
    await chrome.storage.session.set({ lastProblem: "Waverti n’a pas pu effectuer le contrôle. Vérifie la liaison." });
  } finally {
    tickRunning = false;
    await ensureAlarm().catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  action(async () => {
    switch (message?.type) {
      case "status": return publicState();
      case "link": await beginLink(); break;
      case "poll": await pollLink(); break;
      case "enable": await setEnabled(message.enabled === true); break;
      case "authorize": return authorize(message.url);
      case "removeSite": await removeSite(message.site); break;
      case "unlink": await unlink(); break;
      default: throw new Error("invalid_action");
    }
    return publicState();
  }).then((value) => respond({ ok: true, value }), (error) => {
    const known = ["server_update_required", "rate_limited", "server_unavailable", "network"];
    respond({ ok: false, error: known.includes(error?.message) ? error.message : "monitoring_action" });
  });
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) void tick();
});
chrome.runtime.onStartup.addListener(() => void tick());
chrome.runtime.onInstalled.addListener(() => void ensureAlarm().catch(() => {}));
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});
