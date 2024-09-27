"use strict";

import { commands, SetWhitelist } from "../commands";
import {
    CallbackType,
    Command,
    CommandOptionChoice,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";

const CommandObject: Command = {
    name: "whitelist",
    description: "Set whitelist value on a command for a user",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.USER,
            name: "user",
            description: "User to whitelist",
            required: true,
        },
        {
            type: OptionType.STRING,
            name: "name",
            description: "Command to whitelist",
            required: true,
        },
        {
            type: OptionType.BOOLEAN,
            name: "value",
            description: "Whitelist value",
            required: true,
        },
    ],
};

async function ObjectInit(env: Env): Promise<Command> {
    const newObject = CommandObject;

    const newOptions: CommandOptionChoice[] = [];
    for (const i in commands) {
        const cmd = commands[i];

        newOptions.push({
            name: cmd.CommandObject.name,
            value: cmd.CommandObject.name,
        });
    }

    newObject.options[1].choices = newOptions;

    return newObject;
}

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
                content: "No user given",
                flags: 64,
            },
        };
    }
    if (!interaction?.data?.options?.[1]) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No command given",
                flags: 64,
            },
        };
    }
    if (!interaction?.data?.options?.[2]) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No value given",
                flags: 64,
            },
        };
    }

    await SetWhitelist(
        env,
        interaction?.data?.options?.[0].value.toString(),
        interaction?.data?.options?.[1].value.toString(),
        (interaction?.data?.options?.[2].value && true) || false
    );

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: `Set whitelist for ${interaction.data.options[0].value} on command ${interaction.data.options[1].value} to ${interaction.data.options[2].value}`,
        },
    };
}

export { CommandObject, ObjectInit, Execute };
