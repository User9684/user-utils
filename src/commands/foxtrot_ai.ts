"use strict";

import { isWhitelisted } from "../commands";
import {
    CallbackType,
    Command,
    CommandOption,
    CommandOptionChoice,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";

type PromptsReponse = {
    PromptName: string;
    Prompt: string;
}[];

type ChatResponse = {
    response: string;
};

const AIBaseURL = "https://user9684.dev/ai-system/api";

const CommandObject: Command = {
    name: "foxtrotai",
    description: "Chat with Foxtrot AI! (WHITELIST ONLY)",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.STRING,
            name: "ai",
            description: "AI choice",
            required: true,
        },
        {
            type: OptionType.STRING,
            name: "message",
            description: "Message prompt the AI",
            required: true,
        },
        {
            type: OptionType.BOOLEAN,
            name: "vip",
            description: "Whether or not VIP should be enabled",
        },
    ],
};

async function ObjectInit(env: Env): Promise<Command> {
    const newObject = CommandObject;

    const response = await fetch(`${AIBaseURL}/prompts`, {
        headers: {
            "User-Agent": "9684 utilities bot",
            Accept: "application/json",
            "Content-Type": "application/json",
            Token: env.FOXTROTAI_AUTH,
        },
        method: "GET",
    });

    const body: PromptsReponse = await response.json();

    const newOptions: CommandOptionChoice[] = [];
    for (const i in body) {
        const prompt = body[i];

        newOptions.push({
            name: prompt.PromptName,
            value: prompt.PromptName,
        });
    }

    newObject.options[0].choices = newOptions;

    return newObject;
}

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const user = interaction?.member?.user || interaction?.user;
    const userID = (user && user?.id) || "";

    if (!(await isWhitelisted(env, userID, CommandObject.name))) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "You are not whitelisted on this command!",
                flags: 64,
            },
        };
    }

    if (!interaction?.data?.options?.[0]) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No AI given!",
                flags: 64,
            },
        };
    }

    if (!interaction?.data?.options?.[1]) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No message given!",
                flags: 64,
            },
        };
    }

    let context = 1;
    let contextOption = interaction?.data?.options?.[2];
    if (contextOption && contextOption.value === true) {
        context = 2;
    }

    const response = await fetch(`${AIBaseURL}/chat`, {
        headers: {
            "User-Agent": "9684 utilities bot",
            Accept: "application/json",
            "Content-Type": "application/json",
            Token: env.FOXTROTAI_AUTH,
        },
        method: "POST",
        body: JSON.stringify({
            prompt: interaction?.data?.options?.[0].value,
            newMessage: interaction?.data?.options?.[1].value,
            chatContext: context,
            chatContextData: {
                Username: user.username,
                DisplayName: user.global_name || user.username,
                CanUseAIControls: false,
            },
        }),
    });

    const body: ChatResponse = await response.json();

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: body.response,
        },
    };
}

export { CommandObject, ObjectInit, Execute };
