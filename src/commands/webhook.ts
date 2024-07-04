"use strict";

import {
    CallbackType,
    Command,
    Env,
    Interaction,
    InteractionOption,
    InteractionResponse,
    OptionType,
} from "../types";

const webhookHostnames = [
    "discord.com",
    "canary.discord.com",
    "ptb.discord.com",
];

export const CommandObject: Command = {
    name: "webhook",
    description: "Webhook utilities",
    options: [
        {
            type: OptionType.SUB_COMMAND,
            name: "delete",
            description: "Delete a webhook via URL",
            options: [
                {
                    type: OptionType.STRING,
                    name: "webhook",
                    description: "Full webhook URI",
                    required: true,
                },
            ],
        },
        {
            type: OptionType.SUB_COMMAND,
            name: "get",
            description: "Get webhook data",
            options: [
                {
                    type: OptionType.STRING,
                    name: "webhook",
                    description: "Full webhook URI",
                    required: true,
                },
            ],
        },
        {
            type: OptionType.SUB_COMMAND,
            name: "send",
            description: "Send a message to a webhook",
            options: [
                {
                    type: OptionType.STRING,
                    name: "webhook",
                    description: "Full webhook URI",
                    required: true,
                },
                {
                    type: OptionType.STRING,
                    name: "content",
                    description: "Message to send to webhook",
                    required: true,
                },
                {
                    type: OptionType.STRING,
                    name: "username",
                    description: "Webhook username",
                    required: false,
                },
                {
                    type: OptionType.STRING,
                    name: "avatar",
                    description: "Webhook avatar URI",
                    required: false,
                },
                {
                    type: OptionType.BOOLEAN,
                    name: "tts",
                    description: "Send TTS message",
                    required: false,
                },
            ],
        },
    ],
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
};

export async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const subcommandData = interaction?.data?.options?.[0];
    switch (subcommandData?.name) {
        case "delete":
            return await ExecuteDelete(env, interaction, subcommandData);
        case "get":
            return await ExecuteGet(env, interaction, subcommandData);
        case "send":
            return await ExecuteSend(env, interaction, subcommandData);
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "WIP",
            flags: 64,
        },
    };
}

async function getWebhook(webhookURI: string): Promise<Response> {
    return fetch(webhookURI, {
        method: "GET",
    });
}

async function ExecuteDelete(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const webhookURI = options
        .find((x) => x.name == "webhook")
        ?.value.toString();
    const webhookValidation = await VerifyWebhook(webhookURI);

    if (!(webhookValidation instanceof Response)) {
        return webhookValidation;
    }

    const response = await fetch(webhookURI || "", {
        method: "DELETE",
    });

    if (response.status != 204 && response.status != 200) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Failed to delete webhook! Got status ${response.status}`,
            },
        };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Webhook deleted!",
            attachments: [
                {
                    blob: new Blob(
                        [
                            JSON.stringify(
                                await webhookValidation.json(),
                                null,
                                4
                            ),
                        ],
                        {
                            type: "text/plain",
                        }
                    ),
                    fileName: "webhookdata.json",
                },
            ],
        },
    };
}

async function ExecuteGet(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const webhookURI = options
        .find((x) => x.name == "webhook")
        ?.value.toString();
    const webhookValidation = await VerifyWebhook(webhookURI);

    if (!(webhookValidation instanceof Response)) {
        return webhookValidation;
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            attachments: [
                {
                    blob: new Blob(
                        [
                            JSON.stringify(
                                await webhookValidation.json(),
                                null,
                                4
                            ),
                        ],
                        {
                            type: "text/plain",
                        }
                    ),
                    fileName: "webhookdata.json",
                },
            ],
        },
    };
}

async function ExecuteSend(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const webhookURI = options
        .find((x) => x.name == "webhook")
        ?.value.toString();
    const webhookValidation = await VerifyWebhook(webhookURI);

    if (!(webhookValidation instanceof Response)) {
        return webhookValidation;
    }

    const body: any = {
        content: options.find((x) => x.name == "content")?.value.toString(),
        tts:
            Boolean(options.find((x) => x.name == "tts")?.value.toString()) ||
            false,
    };
    const name = options.find((x) => x.name == "username")?.value.toString();
    const avatar = options.find((x) => x.name == "avatar")?.value.toString();
    if (name) body.username = name;
    if (avatar) body.avatar_url = avatar;

    const url = new URL(webhookURI || "");
    url.searchParams.set("wait", "true");

    const response = await fetch(url, {
        body: JSON.stringify(body),
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    });

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Sent message!",
            attachments: [
                {
                    blob: new Blob(
                        [JSON.stringify(await response.json(), null, 4)],
                        {
                            type: "text/plain",
                        }
                    ),
                    fileName: "apiresponse.json",
                },
            ],
        },
    };
}

async function VerifyWebhook(
    webhookURI: string | undefined
): Promise<InteractionResponse | Response> {
    if (!webhookURI || typeof webhookURI !== "string") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Webhook URI invalid.",
            },
        };
    }

    const url = new URL(webhookURI || "");
    if (!webhookHostnames.find((hn) => hn === url.hostname)) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Webhook URI invalid.",
            },
        };
    }

    if (!url.pathname.startsWith("/api/webhooks/")) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Webhook URI invalid.",
            },
        };
    }

    let webhookData: Response;

    try {
        webhookData = await getWebhook(webhookURI);
        if (webhookData.status !== 200) {
            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Invalid Webhook!",
                },
            };
        }
    } catch (err) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Invalid Webhook!",
            },
        };
    }

    return webhookData;
}
