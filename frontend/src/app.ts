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

// Skills state
var skills: api.SkillInfo[] = [];
var activeSkillName = "";
var isCreatingSkill = false;

// ---- Initialization ----

export function init(): void {
    logger.info("app", "Initializing nanobot web frontend");
    ui.initElements();
    ui.initExportElements();
    bindEvents();
    checkSavedLogin();
}

function bindEvents(): void {
    ui.onLogin(handleLogin);
    ui.onLogout(handleLogout);
    ui.onNewSession(handleNewSession);
    ui.onSendMessage(handleSendMessage);
    ui.onDeleteSession(handleDeleteSession);

    // Export
    ui.onExport(handleExport);
    ui.onSelectAll(handleSelectAll);

    // Tab switching
    ui.onTabChat(function () { ui.switchToChat(); });
    ui.onTabSkills(function () {
        ui.switchToSkills();
        loadSkills();
    });

    // Skills
    ui.onNewSkill(handleNewSkill);
    ui.onSaveSkill(handleSaveSkill);
    ui.onCancelSkillEdit(handleCancelSkillEdit);
}

var allSelected = true;

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

// ---- Export ----

function handleExport(): void {
    var msgs = ui.getSelectedMessages();
    if (msgs.length === 0) {
        ui.setStatus("No messages selected", "error");
        return;
    }

    var lines: string[] = [];
    lines.push("# Chat Export — " + currentSessionName);
    lines.push("");
    lines.push("Exported: " + new Date().toISOString());
    lines.push("");
    lines.push("---");
    lines.push("");

    for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var roleLabel = m.role === "user" ? "**You**" : "**nanobot**";
        var tsLabel = m.ts ? " _(" + m.ts + ")_" : "";
        lines.push("### " + roleLabel + tsLabel);
        lines.push("");
        lines.push(m.content);
        lines.push("");
    }

    var markdown = lines.join("\n");
    var filename = "nanobot-" + currentSessionName + "-" + new Date().toISOString().slice(0, 10) + ".md";
    ui.downloadFile(filename, markdown);
    ui.setStatus("Exported " + msgs.length + " messages", "ok");
    logger.info("app", "Exported " + msgs.length + " messages to " + filename);
}

function handleSelectAll(): void {
    allSelected = !allSelected;
    ui.selectAllMessages(allSelected);
    logger.debug("app", "Select all: " + allSelected);
}

// ============================================================
// Skills management
// ============================================================

async function loadSkills(): Promise<void> {
    logger.info("app", "Loading skills");
    try {
        skills = await api.listSkills();
        renderSkills();
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to load skills", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

function renderSkills(): void {
    var items: ui.SkillItem[] = [];
    for (var i = 0; i < skills.length; i++) {
        items.push({
            name: skills[i].name,
            description: skills[i].description,
            source: skills[i].source,
            readonly: skills[i].readonly,
        });
    }
    ui.renderSkillsList(items, activeSkillName, handleViewSkill, handleDeleteSkill);
}

async function handleViewSkill(name: string): Promise<void> {
    logger.info("app", "Viewing skill: " + name);
    activeSkillName = name;
    isCreatingSkill = false;
    renderSkills();

    try {
        var detail = await api.getSkill(name);
        ui.showSkillEditor(detail.name, detail.content, detail.readonly, false);
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to load skill", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

function handleNewSkill(): void {
    logger.info("app", "Creating new skill");
    isCreatingSkill = true;
    activeSkillName = "";
    renderSkills();

    var template = "---\nname: my-skill\ndescription: What this skill does\n---\n\n# My Skill\n\nInstructions here...\n";
    ui.showSkillEditor("", template, false, true);
}

async function handleSaveSkill(): Promise<void> {
    var name = ui.getSkillName();
    var content = ui.getSkillContent();

    if (!name) {
        ui.setStatus("Skill name is required", "error");
        return;
    }
    if (!content) {
        ui.setStatus("Skill content is required", "error");
        return;
    }

    logger.info("app", "Saving skill: " + name);

    try {
        if (isCreatingSkill) {
            await api.createSkill(name, content);
        } else {
            await api.updateSkill(name, content);
        }
        ui.setStatus("Skill saved", "ok");
        isCreatingSkill = false;
        activeSkillName = name;
        await loadSkills();
        // Re-open the saved skill
        await handleViewSkill(name);
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to save skill", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}

function handleCancelSkillEdit(): void {
    logger.info("app", "Cancelled skill edit");
    isCreatingSkill = false;
    activeSkillName = "";
    ui.hideSkillEditor();
    renderSkills();
}

async function handleDeleteSkill(name: string): Promise<void> {
    var confirmed = window.confirm("Delete skill '" + name + "'? This cannot be undone.");
    if (!confirmed) {
        return;
    }

    logger.info("app", "Deleting skill: " + name);

    try {
        await api.deleteSkill(name);
        if (activeSkillName === name) {
            activeSkillName = "";
            ui.hideSkillEditor();
        }
        await loadSkills();
        ui.setStatus("Skill deleted", "ok");
    } catch (e) {
        var errMsg = (e instanceof Error) ? e.message : String(e);
        logger.error("app", "Failed to delete skill", e);
        ui.setStatus("Error: " + errMsg, "error");
    }
}
