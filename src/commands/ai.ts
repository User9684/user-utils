"use strict";

import { isWhitelisted } from "../commands";
import {
    Attachment,
    CallbackType,
    Command,
    Env,
    Interaction,
    InteractionOption,
    InteractionResponse,
    OptionType,
} from "../types";

type BlobData = {
    blob: Blob;
    filename: string;
};

type TTIInput = {
    prompt: string;
    strength: number;
    image?: number[];
};

const ittModel = "@cf/unum/uform-gen2-qwen-500m";
const ttiModel = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

export const CommandObject: Command = {
    name: "ai",
    description: "Ai commands (WHITELIST ONLY)",
    options: [
        {
            type: OptionType.SUB_COMMAND,
            name: "itt",
            description: "Convert an image to text",
            options: [
                {
                    type: OptionType.STRING,
                    name: "prompt",
                    description: "Prompt to give the AI",
                    required: true,
                },
                {
                    type: OptionType.ATTACHMENT,
                    name: "image",
                    description: "Image to describe",
                },
                {
                    type: OptionType.STRING,
                    name: "url",
                    description: "Url to pull image from",
                },
            ],
        },
        {
            type: OptionType.SUB_COMMAND,
            name: "tti",
            description:
                "Convert text (and an optional base image) to an image",
            options: [
                {
                    type: OptionType.STRING,
                    name: "prompt",
                    description: "Prompt to give the AI",
                    required: true,
                },
                {
                    type: OptionType.NUMBER,
                    name: "strength",
                    description: "SD strength",
                    required: true,
                },
                {
                    type: OptionType.ATTACHMENT,
                    name: "image",
                    description: "Image to base off of",
                },
                {
                    type: OptionType.STRING,
                    name: "url",
                    description: "Url to pull image from",
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

    const subcommandData = interaction?.data?.options?.[0];
    switch (subcommandData?.name) {
        case "itt":
            return await ExecuteITT(env, interaction, subcommandData);
        case "tti":
            return await ExecuteTTI(env, interaction, subcommandData);
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "WIP",
            flags: 64,
        },
    };
}

async function BlobFromURL(url: string): Promise<BlobData> {
    const mediaResponse = await fetch(url);

    let fileExtension = "";
    const cd = mediaResponse.headers.get("content-disposition");
    const ct = mediaResponse.headers.get("content-type");
    if (cd) {
        fileExtension = cd.split(".")[1].split('"')[0];
    }
    if (ct) {
        fileExtension = ct.split("/")[1];
    }

    return {
        blob: await mediaResponse.blob(),
        filename: `media.${fileExtension}`,
    };
}

async function blobFromOption(
    option: InteractionOption,
    interaction: Interaction
): Promise<BlobData | null> {
    if (!option) {
        return null;
    }

    let uri: string;

    switch (option.type) {
        case OptionType.ATTACHMENT:
            const attachment: Attachment | null =
                interaction.data.resolved?.attachments?.[`${option.value}`];
            if (!attachment) {
                return null;
            }

            uri = attachment.url;
            break;
        case OptionType.STRING:
            const nURL = new URL(`${option.value}`);
            if (!nURL) {
                return null;
            }

            uri = nURL.toString();
            break;
        default:
            return null;
    }

    const blobdata = await BlobFromURL(uri);

    return blobdata;
}

async function ExecuteITT(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const prompt = options[0].value as string;
    const imgdata = options[1];

    if (!imgdata) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "An attachment or URL is required!",
            },
        };
    }

    const blobdata = await blobFromOption(imgdata, interaction);

    if (blobdata) {
        const input = {
            image: [...(await blobdata.blob.bytes())],
            prompt: prompt,
            max_tokens: 512,
        };

        const res = await env.AI.run(ittModel, input);

        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: res.description,
            },
        };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "erm, whar",
        },
    };
}

async function ExecuteTTI(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const prompt = options[0].value as string;
    const strength = options[1].value as number;
    const imgdata = options[2];

    const blobdata = await blobFromOption(imgdata, interaction);

    const input: TTIInput = {
        prompt: prompt,
        strength: strength,
    };

    if (blobdata) {
        input.image = [...(await blobdata.blob.bytes())];
    }

    const res = await env.AI.run(ttiModel, input);

    const buffer = await new Response(res).arrayBuffer();

    const blob = new Blob([buffer], { type: "application/octet-stream" });

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Done! :3",
            attachments: [
                {
                    blob: blob,
                    fileName: "media.png",
                },
            ],
        },
    };
}
