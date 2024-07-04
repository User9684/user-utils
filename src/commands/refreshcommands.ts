"use strict";

import {
    CallbackType,
    Command,
    Env,
    Interaction,
    InteractionResponse,
} from "../types";
import { Update } from "../updatecommands";

const CommandObject: Command = {
    name: "refresh",
    description: "Refresh bot commands (OWNER ONLY)",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
};

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const userID = interaction?.member?.user?.id || interaction?.user?.id || "";
    if (userID !== env.BOT_OWNER) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "This is an owner only command!",
                flags: 64,
            },
        };
    }

    const body = JSON.stringify(await Update(env), null, 4);

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Refreshed commands!",
            attachments: [
                {
                    blob: new Blob([body], {
                        type: "text/plain",
                    }),
                    fileName: "apiresponse.json",
                },
            ],
            flags: 64,
        },
    };
}

export { CommandObject, Execute };
