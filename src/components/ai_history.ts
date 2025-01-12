import { isWhitelisted } from "../commands";
import {
    application_id,
    DiscordRequest,
    FormFromPayload,
} from "../lib/discord";
import {
    CallbackType,
    ComponentObject,
    Ctx,
    Env,
    Interaction,
    InteractionResponse,
} from "../types";

const ComponentObject: ComponentObject = {
    custom_id: /ai_chat_history_([a-z0-9]+)/i,
};

async function Execute(
    env: Env,
    interaction: Interaction,
    ctx: Ctx
): Promise<InteractionResponse> {
    const user = interaction?.member?.user || interaction?.user;
    const userID = (user && user?.id) || "";

    if (!(await isWhitelisted(env, userID, "ai"))) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "You are not whitelisted on this command!",
                flags: 64,
            },
        };
    }

    const chat_id = [
        ...interaction.data.custom_id.match(ComponentObject.custom_id),
    ][1];

    const chatDataStr = await env.ai_history.get(chat_id);
    if (!chatDataStr) {
        const followup = await FormFromPayload({
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "This conversation has expired.",
            },
        });
        await DiscordRequest(
            env,
            `/webhooks/${application_id(env)}/${interaction.token}`,
            "POST",
            followup
        );

        return {
            type: CallbackType.IGNORE,
            data: {},
        };
    }
    const chatData = JSON.parse(chatDataStr);

    let contextOutput = "";

    let previous = null;
    for (const message of chatData.context) {
        if (message.role === "system") {
            continue;
        }

        if (previous === null) {
            previous = message;
        } else {
            contextOutput +=
                `${previous.content} -> ${message.content.response}`.replaceAll(
                    "\n",
                    "\\n"
                ) + "\n";
            previous = null;
        }
    }

    const formattedStr = `#### BEGIN SETTINGS ####\nModel: ${
        chatData.model
    }\nFine-tune name: ${chatData.finetune || "none"}\nTemperature: ${
        chatData.temp || 1
    }\nSystem prompt: ${
        chatData.system || "none"
    }\n\n#### BEGIN HISTORY ####\n${contextOutput}`;

    const followup = await FormFromPayload({
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            attachments: [
                {
                    blob: new Blob([formattedStr], {
                        type: "text/plain",
                    }),
                    fileName: "history.txt",
                },
            ],
        },
    });
    await DiscordRequest(
        env,
        `/webhooks/${application_id(env)}/${interaction.token}`,
        "POST",
        followup
    );

    return {
        type: CallbackType.IGNORE,
        data: {},
    };
}

export { ComponentObject, Execute };
