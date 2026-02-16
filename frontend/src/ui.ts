/**
 * UI rendering and DOM manipulation.
 */

import * as logger from "./logger.js";

// ---- DOM element references ----

var loginScreen: HTMLElement;
var chatScreen: HTMLElement;
var usernameInput: HTMLInputElement;
var loginButton: HTMLButtonElement;
var currentUserLabel: HTMLElement;
var logoutButton: HTMLButtonElement;
var sessionList: HTMLElement;
var newSessionInput: HTMLInputElement;
var newSessionButton: HTMLButtonElement;
var messagesContainer: HTMLElement;
var messageInput: HTMLTextAreaElement;
var sendButton: HTMLButtonElement;
var activeSessionLabel: HTMLElement;
var statusIndicator: HTMLElement;
var deleteSessionButton: HTMLButtonElement;
var userAvatar: HTMLElement;

export function initElements(): void {
    loginScreen = getEl("login-screen");
    chatScreen = getEl("chat-screen");
    usernameInput = getEl("username-input") as HTMLInputElement;
    loginButton = getEl("login-button") as HTMLButtonElement;
    currentUserLabel = getEl("current-user");
    logoutButton = getEl("logout-button") as HTMLButtonElement;
    sessionList = getEl("session-list");
    newSessionInput = getEl("new-session-input") as HTMLInputElement;
    newSessionButton = getEl("new-session-button") as HTMLButtonElement;
    messagesContainer = getEl("messages");
    messageInput = getEl("message-input") as HTMLTextAreaElement;
    sendButton = getEl("send-button") as HTMLButtonElement;
    activeSessionLabel = getEl("active-session");
    statusIndicator = getEl("status");
    deleteSessionButton = getEl("delete-session-button") as HTMLButtonElement;
    userAvatar = getEl("user-avatar");
    logger.info("ui", "DOM elements initialized");
}

function getEl(id: string): HTMLElement {
    var el = document.getElementById(id);
    if (!el) {
        throw new Error("Element not found: " + id);
    }
    return el;
}

// ---- Screen switching ----

export function showLogin(): void {
    loginScreen.style.display = "flex";
    chatScreen.style.display = "none";
    usernameInput.focus();
}

export function showChat(username: string): void {
    loginScreen.style.display = "none";
    chatScreen.style.display = "flex";
    currentUserLabel.textContent = username;
    userAvatar.textContent = username.charAt(0).toUpperCase();
    messageInput.focus();
}

// ---- Session list ----

export interface SessionItem {
    key: string;
    name: string;
    active: boolean;
}

export function renderSessionList(sessions: SessionItem[], onClick: (key: string, name: string) => void): void {
    sessionList.innerHTML = "";
    for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        var li = document.createElement("li");
        li.textContent = s.name;
        li.setAttribute("data-key", s.key);
        if (s.active) {
            li.className = "active";
        }
        // Use closure to capture the correct session
        (function (key: string, name: string) {
            li.addEventListener("click", function () {
                onClick(key, name);
            });
        })(s.key, s.name);
        sessionList.appendChild(li);
    }
    logger.debug("ui", "Rendered session list", { count: sessions.length });
}

// ---- Messages ----

export function clearMessages(): void {
    messagesContainer.innerHTML = "";
}

export function addMessage(role: string, content: string, ts?: string): void {
    var div = document.createElement("div");
    div.className = "message " + role;

    var header = document.createElement("div");
    header.className = "message-header";
    var roleLabel = role === "user" ? "You" : "nanobot";
    if (ts) {
        header.textContent = roleLabel + " · " + formatTimestamp(ts);
    } else {
        header.textContent = roleLabel;
    }

    var body = document.createElement("div");
    body.className = "message-body";
    body.textContent = content;

    div.appendChild(header);
    div.appendChild(body);
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function addThinkingIndicator(): HTMLElement {
    var div = document.createElement("div");
    div.className = "message assistant thinking";
    div.innerHTML = '<div class="message-header">nanobot</div><div class="message-body">Thinking...</div>';
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return div;
}

export function removeElement(el: HTMLElement): void {
    if (el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

// ---- Active session label ----

export function setActiveSession(name: string): void {
    activeSessionLabel.textContent = name;
}

export function setNoActiveSession(): void {
    activeSessionLabel.textContent = "No session selected";
}

// ---- Status ----

export function setStatus(text: string, type: "ok" | "error" | "loading"): void {
    statusIndicator.textContent = text;
    statusIndicator.className = "status " + type;
}

// ---- Input controls ----

export function getUsername(): string {
    return usernameInput.value.trim();
}

export function getNewSessionName(): string {
    return newSessionInput.value.trim();
}

export function clearNewSessionInput(): void {
    newSessionInput.value = "";
}

export function getMessageText(): string {
    return messageInput.value.trim();
}

export function clearMessageInput(): void {
    messageInput.value = "";
}

export function setInputEnabled(enabled: boolean): void {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
}

// ---- Event binding ----

export function onLogin(handler: () => void): void {
    loginButton.addEventListener("click", handler);
    usernameInput.addEventListener("keydown", function (e: KeyboardEvent) {
        if (e.key === "Enter") {
            handler();
        }
    });
}

export function onLogout(handler: () => void): void {
    logoutButton.addEventListener("click", handler);
}

export function onNewSession(handler: () => void): void {
    newSessionButton.addEventListener("click", handler);
    newSessionInput.addEventListener("keydown", function (e: KeyboardEvent) {
        if (e.key === "Enter") {
            handler();
        }
    });
}

export function onSendMessage(handler: () => void): void {
    sendButton.addEventListener("click", handler);
    messageInput.addEventListener("keydown", function (e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handler();
        }
    });
}

export function onDeleteSession(handler: () => void): void {
    deleteSessionButton.addEventListener("click", handler);
}

// ---- Helpers ----

function formatTimestamp(ts: string): string {
    try {
        var d = new Date(ts);
        return d.toLocaleTimeString();
    } catch (e) {
        return ts;
    }
}
