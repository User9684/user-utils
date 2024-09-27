"use strict";
import { BotCommand, BotComponent, Env } from "./types";

import * as refresh from "./commands/refreshcommands";
import * as webhook from "./commands/webhook";
import * as say from "./commands/say";
import * as whois from "./commands/whois";
import * as report from "./commands/report";
import * as cobalt from "./commands/cobalt";
import * as foxtrotai from "./commands/foxtrot_ai";
import * as whitelist from "./commands/whitelist";
import * as ai from "./commands/ai";
import * as whois_select_menu from "./components/whois_select_menu";
import * as whois_next from "./components/whois_next";

export const commands: { [id: string]: BotCommand } = {
    refresh,
    webhook,
    say,
    whois,
    report,
    cobalt,
    foxtrotai,
    whitelist,
    ai,
};

export const components: { [id: string]: BotComponent } = {
    whois_select_menu,
    whois_next,
    whois_previous: whois_next,
};

export async function isWhitelisted(
    env: Env,
    userID: string,
    cmdName: string
): Promise<Boolean> {
    const whitelistValue = await env.CommandWhitelist.get(
        `${userID}_${cmdName}`
    );

    return whitelistValue == "1";
}

export async function SetWhitelist(
    env: Env,
    userID: string,
    cmdName: string,
    value: boolean
) {
    if (value) {
        await env.CommandWhitelist.put(`${userID}_${cmdName}`, "1");

        return;
    }

    await env.CommandWhitelist.delete(`${userID}_${cmdName}`);
}
