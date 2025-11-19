import { BotCommand, BotComponent, BotModal, Env } from "./types";

import * as refresh from "./commands/refreshcommands";
import * as webhook from "./commands/webhook";
import * as say from "./commands/say";
import * as whois from "./commands/whois";
import * as report from "./commands/report";
import * as cobalt from "./commands/cobalt";
import * as cobalt_message from "./commands/cobalt_message";
import * as whitelist from "./commands/whitelist";
import * as ai from "./commands/ai";
import * as color from "./commands/color"
import * as roblox from "./commands/roblox"
import * as summary from "./commands/summary_message";
import * as whois_select_menu from "./components/whois_select_menu";
import * as whois_next from "./components/whois_next";
import * as ai_chat_reply from "./components/ai_reply";
import * as ai_chat_history from "./components/ai_history";
import * as ai_chat_reply_modal from "./modals/ai_reply";

export const commands: { [id: string]: BotCommand } = {
    refresh,
    webhook,
    say,
    whois,
    report,
    cobalt,
    cobalt_message,
    whitelist,
    ai,
    summary,
    color,
    roblox,
};

export const components: { [id: string]: BotComponent } = {
    whois_select_menu,
    whois_next,
    whois_previous: whois_next,
    ai_chat_reply,
    ai_chat_history,
};

export const modals: { [id: string]: BotModal } = {
    ai_chat_reply_modal,
};

export async function isWhitelisted(
    env: Env,
    userID: string,
    cmdName: string
): Promise<boolean> {
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
