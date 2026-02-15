/**
 * Main application logic.
 * Coordinates between the API client and the UI.
 */

import * as api from "./api.js";
import * as ui from "./ui.js";
import * as logger from "./logger.js";

// ---- Application state ----

var currentUsername = "";
var currentSessionKey = "";
var currentSessionName = "";
var sessions: api.SessionInfo[] = [];

// ---- Initialization ----

export function init(): void {
    logger.info("app", "Initializing nanobot web frontend");
    ui.initElements();
    bindEvents();
    checkSavedLogin();
}

function bindEvents(): void {
    ui.onLogin(handleLogin);
    ui.onLogout(handleLogout);
    ui.onNewSession(handleNewSession);
    ui.onSendMessage(handleSendMessage);
    ui.onDeleteSession(handleDeleteSession);
}

function checkSavedLogin(): void {
    var saved = localStorage.getItem("nanobot_username");
    if (saved) {
        logger.info("app", "Restoring saved login: " + saved);
        currentUsername = saved;
        enterChat();
    } else {
        ui.showLogin();
    }
}

// ---- Login / Logout ----

function handleLogin(): void {
    var username = ui.getUsername();
    if (!username) {
        logger.warn("app", "Login attempted with empty username");
        return;
    }
    logger.info("app", "User logging in: " + username);
    currentUsername = username;
    localStorage.setItem("nanobot_username", username);
    enterChat();
}

function handleLogout(): void {
    logger.info("app", "User logging out: " + currentUsername);
    currentUsername = "";
    currentSessionKey = "";
    currentSessionName = "";
    sessions = [];
    localStorage.removeItem("nanobot_username");
    ui.showLogin();
}

async function enterChat(): Promise<void> {
    ui.showChat(currentUsername);
    ui.setStatus("Loading sessions...", "loading");
    ui.setNoActiveSession();
    ui.clearMessages();
    ui.setInputEnabled(false);

    try {
        await loadSessions();
        ui.setStatus("Connected", "ok");

        // Auto-select the first session if available
        if (sessions.length > 0) {
            await selectSession(sessions[0].key, sessions[0].name);
        }
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to load sessions", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

// ---- Sessions ----

async function loadSessions(): Promise<void> {
    logger.info("app", "Loading sessions for user: " + currentUsername);
    sessions = await api.listSessions(currentUsername);
    renderSessions();
}

function renderSessions(): void {
    var items: ui.SessionItem[] = [];
    for (var i = 0; i < sessions.length; i++) {
        items.push({
            key: sessions[i].key,
            name: sessions[i].name,
            active: sessions[i].key === currentSessionKey,
        });
    }
    ui.renderSessionList(items, function (key: string, name: string) {
        selectSession(key, name);
    });
}

async function selectSession(key: string, name: string): Promise<void> {
    logger.info("app", "Selecting session: " + key);
    currentSessionKey = key;
    currentSessionName = name;
    ui.setActiveSession(name);
    ui.setInputEnabled(true);
    renderSessions();

    // Load history
    ui.clearMessages();
    ui.setStatus("Loading history...", "loading");

    try {
        var messages = await api.getHistory(key);
        for (var i = 0; i < messages.length; i++) {
            ui.addMessage(messages[i].role, messages[i].content, messages[i].timestamp);
        }
        ui.setStatus("Connected", "ok");
        logger.info("app", "Loaded " + messages.length + " messages for session " + key);
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to load history", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

async function handleNewSession(): Promise<void> {
    var name = ui.getNewSessionName();
    if (!name) {
        logger.warn("app", "New session attempted with empty name");
        return;
    }

    logger.info("app", "Creating new session: " + name);
    ui.clearNewSessionInput();

    try {
        var newSession = await api.createSession(currentUsername, name);
        sessions.unshift(newSession);
        renderSessions();
        await selectSession(newSession.key, newSession.name);
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to create session", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

async function handleDeleteSession(): Promise<void> {
    if (!currentSessionKey) {
        return;
    }

    var confirmed = window.confirm("Delete session '" + currentSessionName + "'? This will clear all messages.");
    if (!confirmed) {
        return;
    }

    logger.info("app", "Deleting session: " + currentSessionKey);

    try {
        await api.deleteSession(currentSessionKey);
        // Remove from local list
        sessions = sessions.filter(function (s) {
            return s.key !== currentSessionKey;
        });
        currentSessionKey = "";
        currentSessionName = "";
        ui.setNoActiveSession();
        ui.clearMessages();
        ui.setInputEnabled(false);
        renderSessions();

        if (sessions.length > 0) {
            await selectSession(sessions[0].key, sessions[0].name);
        }
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to delete session", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

// ---- Chat ----

async function handleSendMessage(): Promise<void> {
    var text = ui.getMessageText();
    if (!text || !currentSessionKey) {
        return;
    }

    logger.info("app", "Sending message in session " + currentSessionKey + ": " + text.substring(0, 80));
    ui.clearMessageInput();
    ui.addMessage("user", text);
    ui.setInputEnabled(false);
    ui.setStatus("nanobot is thinking...", "loading");

    var thinkingEl = ui.addThinkingIndicator();

    try {
        var result = await api.sendMessage(currentUsername, currentSessionName, text);
        ui.removeElement(thinkingEl);
        ui.addMessage("assistant", result.response);
        ui.setStatus("Connected", "ok");
        logger.info("app", "Received response, length=" + result.response.length);
    } catch (e) {
        ui.removeElement(thinkingEl);
        var errMsg = (e instanceof Error) ? e.message : String(e);
        ui.addMessage("assistant", "Error: " + errMsg);
        ui.setStatus("Error", "error");
        logger.error("app", "Chat error", e);
    } finally {
        ui.setInputEnabled(true);
    }
}
