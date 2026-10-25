import { EXTENSION_ID } from "../config";

export function connectExtension(token) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      reject(new Error("Extension connection is unavailable. Reload the extension and open http://localhost:5173 in the same Chrome profile."));
      return;
    }
    const timer = setTimeout(() => reject(new Error("The extension did not respond. Reload it and try connecting again.")), 95000);
    try {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: "AUTHENTICATE", token }, (response) => {
        clearTimeout(timer);
        const transportError = chrome.runtime.lastError;
        if (transportError) {
          reject(new Error(`Could not reach the extension: ${transportError.message}`));
        } else if (!response?.success) {
          reject(new Error(response?.error || "The extension did not confirm the connection. Reload it and try again."));
        } else {
          resolve();
        }
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}
