import { captureAmazonProduct } from "./capture.js";

const button = document.getElementById("capture");
const status = document.getElementById("status");
const destination = "https://www.waverti.com/app/surveillances/nouvelle";

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeUrl = URL.canParse(tab?.url) ? new URL(tab.url) : null;
    if (!tab?.id || !activeUrl || activeUrl.protocol !== "https:" ||
        !["amazon.fr", "www.amazon.fr"].includes(activeUrl.host)) {
      status.textContent = "Ouvre une fiche produit Amazon.fr dans l’onglet actif, puis réessaie.";
      return;
    }

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureAmazonProduct,
    });
    const result = injection?.result;
    if (!result?.ok) {
      status.textContent = result?.code === "not_product"
        ? "Ouvre la fiche d’un produit Amazon.fr, puis réessaie."
        : "Aucun prix ni stock fiable n’est visible. Sélectionne la variante et attends l’affichage de l’offre, puis réessaie.";
      return;
    }

    const fragment = encodeURIComponent(JSON.stringify(result.observation));
    await chrome.tabs.create({ url: destination + "#waverti-releve=" + fragment });
    window.close();
  } catch {
    status.textContent = "La page n’a pas pu être lue. Recharge la fiche Amazon.fr, puis réessaie.";
  } finally {
    button.disabled = false;
  }
});
