/**
 * API client for communicating with the nanobot backend.
 */

import * as logger from "./logger.js";

var API_BASE = "";

export interface SessionInfo {
    key: string;
    name: string;
    created_at: string | null;
    updated_at: string | null;
}

export interface ChatMessage {
    role: string;
    content: string;
    timestamp: string;
}

export interface ChatResponse {
    response: string;
    session_key: string;
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    var url = API_BASE + path;
    logger.debug("api", method + " " + url, body);

    var options: RequestInit = {
        method: method,
        headers: { "Content-Type": "application/json" },
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    var res = await fetch(url, options);
    var data = await res.json();

    if (!res.ok) {
        var errMsg = (data as Record<string, string>).error || "Request failed";
        logger.error("api", "Request failed: " + errMsg, { status: res.status, data: data });
        throw new Error(errMsg);
    }

    logger.info("api", "Response from " + path, data);
    return data;
}

export async function listSessions(username: string): Promise<SessionInfo[]> {
    var data = await request("GET", "/api/sessions?username=" + encodeURIComponent(username)) as Record<string, unknown>;
    return (data.sessions || []) as SessionInfo[];
}

export async function getHistory(sessionKey: string): Promise<ChatMessage[]> {
    var data = await request("GET", "/api/history?session_key=" + encodeURIComponent(sessionKey)) as Record<string, unknown>;
    return (data.messages || []) as ChatMessage[];
}

export async function sendMessage(username: string, sessionName: string, message: string): Promise<ChatResponse> {
    var data = await request("POST", "/api/chat", {
        username: username,
        session_name: sessionName,
        message: message,
    });
    return data as ChatResponse;
}

export async function createSession(username: string, sessionName: string): Promise<SessionInfo> {
    var data = await request("POST", "/api/sessions/create", {
        username: username,
        session_name: sessionName,
    }) as Record<string, string>;
    return {
        key: data.session_key,
        name: data.name,
        created_at: null,
        updated_at: null,
    };
}

export async function deleteSession(sessionKey: string): Promise<void> {
    await request("POST", "/api/sessions/delete", {
        session_key: sessionKey,
    });
}

export async function healthCheck(): Promise<boolean> {
    try {
        await request("GET", "/api/health");
        return true;
    } catch (e) {
        return false;
    }
}

// ---- Skills API ----

export interface SkillInfo {
    name: string;
    description: string;
    source: string;
    readonly: boolean;
}

export interface SkillDetail {
    name: string;
    content: string;
    source: string;
    readonly: boolean;
}

export async function listSkills(): Promise<SkillInfo[]> {
    var data = await request("GET", "/api/skills") as Record<string, unknown>;
    return (data.skills || []) as SkillInfo[];
}

export async function getSkill(name: string): Promise<SkillDetail> {
    var data = await request("GET", "/api/skills/get?name=" + encodeURIComponent(name));
    return data as SkillDetail;
}

export async function createSkill(name: string, content: string): Promise<void> {
    await request("POST", "/api/skills/create", { name: name, content: content });
}

export async function updateSkill(name: string, content: string): Promise<void> {
    await request("POST", "/api/skills/update", { name: name, content: content });
}

export async function deleteSkill(name: string): Promise<void> {
    await request("POST", "/api/skills/delete", { name: name });
}
