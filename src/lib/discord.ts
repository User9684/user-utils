"use strict";

import { Env, InteractionResponse } from "../types";

export const apiBaseURL = "https://discord.com/api/v10";

const alg = "NODE-ED25519";
const encoder = new TextEncoder();

export function application_id(env: Env): string {
    const tokenSplit = env.TOKEN.split(".");
    const applicationId = atob(tokenSplit[0]);

    return applicationId;
}

function hex2bin(hex: string) {
    const buf = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < buf.length; i++) {
        buf[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return buf;
}

export async function VerifyRequest(
    request: Request,
    env: Env
): Promise<boolean> {
    const IMPORTED_KEY = await crypto.subtle.importKey(
        "raw",
        hex2bin(env.PUBLIC_KEY),
        {
            name: alg,
            namedCurve: alg,
        },
        true,
        ["verify"]
    );

    const sigHeader = request.headers.get("X-Signature-Ed25519");
    const tsHeader = request.headers.get("X-Signature-Timestamp");
    if (!sigHeader || !tsHeader) {
        return false;
    }
    const body = await request.clone().text();
    const sig = hex2bin(sigHeader);

    return await crypto.subtle.verify(
        { name: alg },
        IMPORTED_KEY,
        sig,
        encoder.encode(tsHeader + body)
    );
}

export async function FormFromPayload(payload: InteractionResponse): Promise<FormData> {
    const form = new FormData();

    const attachments = payload.data?.attachments || [];
    const newAttachments: any = [];

    for (const index in attachments) {
        const attachment = attachments[index];
        form.append(`files[${index}]`, attachment.blob, attachment.fileName);
        newAttachments.push({
            id: Number(index),
            filename: attachment.fileName,
        });
    }

    if (payload.data?.attachments) {
        payload.data.attachments = newAttachments;
    }

    form.append("payload_json", JSON.stringify(payload));

    return form;
}

export async function DiscordRequest(
    env: Env,
    path: string,
    method: string,
    body?: any
): Promise<Response> {
    const requestURI = apiBaseURL + path;
    console.log(`Sending request to ${requestURI}`);

    const requestBody =
        (body instanceof FormData && body) || JSON.stringify(body);

    return fetch(requestURI, {
        method: method,
        headers: {
            Authorization: `Bot ${env.TOKEN}`,
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent": "9684 utilities bot",
        },
        body: requestBody,
    });
}