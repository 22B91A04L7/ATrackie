// Handles authentication and logout requests from the website
chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {

        // Handle manual entry job request
        if (message.type === "GET_MANUAL_ENTRY_JOB") {
            chrome.storage.local.get(["manualEntryJob"], (result) => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message,
                    });
                    return;
                }

                sendResponse({
                    success: true,
                    job: result.manualEntryJob || null,
                });
            });

            return true;
        }

        //saves manual job entry to pending after manual edit
        if (message.type === "SAVE_MANUAL_ENTRY_JOB") {
            chrome.storage.local.set(
                {
                    pendingJob: message.job,
                },
                () => {
                    if (chrome.runtime.lastError) {
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message,
                        });
                        return;
                    }

                    chrome.storage.local.remove(["manualEntryJob"], () => {
                        if (chrome.runtime.lastError) {
                            sendResponse({
                                success: false,
                                error: chrome.runtime.lastError.message,
                            });
                            return;
                        }

                        sendResponse({
                            success: true,
                        });
                    });
                },
            );

            return true;
        }

        // Handle logout request
        if (message.type === "LOGOUT") {
            chrome.storage.local.remove(["token", "pendingJob"], () => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message,
                    });
                    return;
                }

                sendResponse({
                    success: true,
                });
            });

            return true;
        }

        // Ignore unknown message types
        if (message.type !== "AUTHENTICATE") {
            return;
        }

        // Handle authentication request
        if (!message.token) {
            sendResponse({
                success: false,
                error: "Authentication token is missing.",
            });
            return;
        }

        chrome.storage.local.set(
            { token: message.token },
            () => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message,
                    });
                    return;
                }

                sendResponse({
                    success: true,
                });
            },
        );

        return true;
    },
);

// Badge helper functions
function setPendingBadge() {
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#2f5bd3" });
}

function clearPendingBadge() {
    chrome.action.setBadgeText({ text: "" });
}

// Sync badge with pendingJob in storage
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.pendingJob) {
        if (changes.pendingJob.newValue) {
            setPendingBadge();
        } else {
            clearPendingBadge();
        }
    }
});

// Initialize badge on service worker startup
async function initializeBadge() {
    const result = await chrome.storage.local.get(["pendingJob"]);
    if (result.pendingJob) {
        setPendingBadge();
    } else {
        clearPendingBadge();
    }
}
initializeBadge();