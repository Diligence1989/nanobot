/**
 * UI rendering and DOM manipulation.
 */

import * as logger from "./logger.js";
import { renderMarkdown, attachHtmlPreviews } from "./render.js";

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

// Skills panel elements
var tabChat: HTMLButtonElement;
var tabSkills: HTMLButtonElement;
var panelChat: HTMLElement;
var panelSkills: HTMLElement;
var skillsList: HTMLElement;
var skillsNewButton: HTMLButtonElement;
var skillEditor: HTMLElement;
var skillNameInput: HTMLInputElement;
var skillContentInput: HTMLTextAreaElement;
var skillSaveButton: HTMLButtonElement;
var skillCancelButton: HTMLButtonElement;
var skillSourceBadge: HTMLElement;

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

    // Skills
    tabChat = getEl("tab-chat") as HTMLButtonElement;
    tabSkills = getEl("tab-skills") as HTMLButtonElement;
    panelChat = getEl("panel-chat");
    panelSkills = getEl("panel-skills");
    skillsList = getEl("skills-list");
    skillsNewButton = getEl("skills-new-button") as HTMLButtonElement;
    skillEditor = getEl("skill-editor");
    skillNameInput = getEl("skill-name-input") as HTMLInputElement;
    skillContentInput = getEl("skill-content-input") as HTMLTextAreaElement;
    skillSaveButton = getEl("skill-save-button") as HTMLButtonElement;
    skillCancelButton = getEl("skill-cancel-button") as HTMLButtonElement;
    skillSourceBadge = getEl("skill-source-badge");

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
    div.setAttribute("data-role", role);
    div.setAttribute("data-content", content);
    div.setAttribute("data-ts", ts || "");

    var header = document.createElement("div");
    header.className = "message-header";
    var roleLabel = role === "user" ? "You" : "nanobot";

    // Checkbox for export selection
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "msg-checkbox";
    checkbox.checked = true;

    var headerText = document.createElement("span");
    if (ts) {
        headerText.textContent = roleLabel + " · " + formatTimestamp(ts);
    } else {
        headerText.textContent = roleLabel;
    }

    // Copy button
    var copyBtn = document.createElement("button");
    copyBtn.className = "msg-copy-btn";
    copyBtn.title = "Copy";
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    (function (text: string, btn: HTMLButtonElement) {
        btn.addEventListener("click", function () {
            copyToClipboard(text);
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(function () {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
            }, 1500);
        });
    })(content, copyBtn as HTMLButtonElement);

    header.appendChild(checkbox);
    header.appendChild(headerText);
    header.appendChild(copyBtn);

    var body = document.createElement("div");
    body.className = "message-body";
    body.innerHTML = renderMarkdown(content);

    div.appendChild(header);
    div.appendChild(body);
    messagesContainer.appendChild(div);

    // Attach preview buttons to HTML code blocks
    attachHtmlPreviews(body);

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

function copyToClipboard(text: string): void {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(function () {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text: string): void {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
}

// ---- Export ----

export function getSelectedMessages(): Array<{ role: string; content: string; ts: string }> {
    var result: Array<{ role: string; content: string; ts: string }> = [];
    var msgs = messagesContainer.querySelectorAll(".message");
    for (var i = 0; i < msgs.length; i++) {
        var el = msgs[i] as HTMLElement;
        var cb = el.querySelector(".msg-checkbox") as HTMLInputElement | null;
        if (cb && cb.checked) {
            result.push({
                role: el.getAttribute("data-role") || "",
                content: el.getAttribute("data-content") || "",
                ts: el.getAttribute("data-ts") || "",
            });
        }
    }
    return result;
}

export function selectAllMessages(checked: boolean): void {
    var boxes = messagesContainer.querySelectorAll(".msg-checkbox");
    for (var i = 0; i < boxes.length; i++) {
        (boxes[i] as HTMLInputElement).checked = checked;
    }
}

export function downloadFile(filename: string, content: string): void {
    var blob = new Blob([content], { type: "text/markdown; charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---- Export button bindings ----

var exportButton: HTMLButtonElement;
var selectAllButton: HTMLButtonElement;

export function initExportElements(): void {
    exportButton = getEl("export-button") as HTMLButtonElement;
    selectAllButton = getEl("select-all-button") as HTMLButtonElement;
}

export function onExport(handler: () => void): void {
    exportButton.addEventListener("click", handler);
}

export function onSelectAll(handler: () => void): void {
    selectAllButton.addEventListener("click", handler);
}

// ============================================================
// Tab switching
// ============================================================

export function switchToChat(): void {
    tabChat.classList.add("active");
    tabSkills.classList.remove("active");
    panelChat.style.display = "flex";
    panelSkills.style.display = "none";
}

export function switchToSkills(): void {
    tabChat.classList.remove("active");
    tabSkills.classList.add("active");
    panelChat.style.display = "none";
    panelSkills.style.display = "flex";
}

export function onTabChat(handler: () => void): void {
    tabChat.addEventListener("click", handler);
}

export function onTabSkills(handler: () => void): void {
    tabSkills.addEventListener("click", handler);
}

// ============================================================
// Skills list
// ============================================================

export interface SkillItem {
    name: string;
    description: string;
    source: string;
    readonly: boolean;
}

export function renderSkillsList(
    skills: SkillItem[],
    activeSkill: string,
    onView: (name: string) => void,
    onDelete: (name: string) => void
): void {
    skillsList.innerHTML = "";
    for (var i = 0; i < skills.length; i++) {
        var s = skills[i];
        var card = document.createElement("div");
        card.className = "skill-card";
        if (s.name === activeSkill) {
            card.className += " active";
        }

        // Icon
        var icon = document.createElement("div");
        icon.className = "skill-icon " + s.source;
        icon.textContent = s.name.charAt(0).toUpperCase();

        // Info
        var info = document.createElement("div");
        info.className = "skill-info";
        var nameEl = document.createElement("div");
        nameEl.className = "skill-name";
        nameEl.textContent = s.name;
        var descEl = document.createElement("div");
        descEl.className = "skill-desc";
        descEl.textContent = s.description || "No description";
        info.appendChild(nameEl);
        info.appendChild(descEl);

        // Badge
        var badge = document.createElement("span");
        badge.className = "skill-badge " + s.source;
        badge.textContent = s.source;

        card.appendChild(icon);
        card.appendChild(info);
        card.appendChild(badge);

        // Delete button for user skills
        if (!s.readonly) {
            var actions = document.createElement("div");
            actions.className = "skill-card-actions";
            var delBtn = document.createElement("button");
            delBtn.className = "btn-icon btn-danger";
            delBtn.title = "Delete skill";
            delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            (function (skillName: string) {
                delBtn.addEventListener("click", function (e: Event) {
                    e.stopPropagation();
                    onDelete(skillName);
                });
            })(s.name);
            actions.appendChild(delBtn);
            card.appendChild(actions);
        }

        // Click to view
        (function (skillName: string) {
            card.addEventListener("click", function () {
                onView(skillName);
            });
        })(s.name);

        skillsList.appendChild(card);
    }
}

// ============================================================
// Skill editor
// ============================================================

export function showSkillEditor(name: string, content: string, readonly: boolean, isNew: boolean): void {
    skillEditor.style.display = "flex";
    skillNameInput.value = name;
    skillContentInput.value = content;
    skillNameInput.disabled = !isNew;
    skillContentInput.disabled = readonly;
    skillSaveButton.style.display = readonly ? "none" : "flex";

    if (readonly) {
        skillSourceBadge.textContent = "read-only";
        skillSourceBadge.className = "skill-badge readonly";
    } else if (isNew) {
        skillSourceBadge.textContent = "new";
        skillSourceBadge.className = "skill-badge user";
    } else {
        skillSourceBadge.textContent = "user";
        skillSourceBadge.className = "skill-badge user";
    }
}

export function hideSkillEditor(): void {
    skillEditor.style.display = "none";
    skillNameInput.value = "";
    skillContentInput.value = "";
}

export function getSkillName(): string {
    return skillNameInput.value.trim();
}

export function getSkillContent(): string {
    return skillContentInput.value;
}

export function onNewSkill(handler: () => void): void {
    skillsNewButton.addEventListener("click", handler);
}

export function onSaveSkill(handler: () => void): void {
    skillSaveButton.addEventListener("click", handler);
}

export function onCancelSkillEdit(handler: () => void): void {
    skillCancelButton.addEventListener("click", handler);
}
