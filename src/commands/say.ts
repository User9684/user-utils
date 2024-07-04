"use strict";

import {
    CallbackType,
    Command,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";

const CommandObject: Command = {
    name: "say",
    description: "Send a message in chat (OWNER ONLY)",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.STRING,
            name: "message",
            description: "Message to say in chat",
            required: true,
        },
    ],
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

    if (!interaction?.data?.options?.[0]) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No message given",
                flags: 64,
            },
        };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: interaction.data.options[0].value.toString(),
        },
    };
}

export { CommandObject, Execute };
