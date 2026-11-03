import { capturePage } from "./capture.js";

const button = document.getElementById("capture");
const form = document.getElementById("paste");
const input = document.getElementById("page-url");
const status = document.getElementById("status");
const destination = "https://www.waverti.com/app/surveillances/nouvelle";

async function openWaverti(observation) {
  const fragment = encodeURIComponent(JSON.stringify(observation));
  await chrome.tabs.create({ url: destination + "#waverti-releve=" + fragment });
  window.close();
}

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "";
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
