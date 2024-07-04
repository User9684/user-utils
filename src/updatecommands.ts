"use strict";

import { Command, Env } from "./types";
import { commands } from "./commands";
import { DiscordRequest } from "./lib/discord";

export async function Update(env: Env): Promise<any> {
    const tokenSplit = env.TOKEN.split(".");
    const applicationId = atob(tokenSplit[0]);
    const apiURL = "/applications/" + applicationId + "/commands";

    const commandObjects: Command[] = [];

    for (const index in commands) {
        const command = commands[index];
        commandObjects.push({ ...command.CommandObject });
    }

    const response = await DiscordRequest(env, apiURL, "PUT", commandObjects);

    return response.json();
}
