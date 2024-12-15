"use strict";

import { isWhitelisted } from "../commands";
import {
    Attachment,
    CallbackType,
    Command,
    CommandOption,
    CommandOptionChoice,
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

const ittModels = [
    "@cf/unum/uform-gen2-qwen-500m",
    "@cf/llava-hf/llava-1.5-7b-hf",
];
const ttiModels = [
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    "@cf/bytedance/stable-diffusion-xl-lightning",
    "@cf/runwayml/stable-diffusion-v1-5-img2img",
    "@cf/runwayml/stable-diffusion-v1-5-inpainting",
];

const CommandObject: Command = {
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
                {
                    type: OptionType.STRING,
                    name: "model",
                    description: "AI model to use",
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
                {
                    type: OptionType.STRING,
                    name: "model",
                    description: "AI model to use",
                },
            ],
        },
    ],
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
};

async function ObjectInit(env: Env): Promise<Command> {
    // Set image-to-text model choices
    const ittOptions: CommandOptionChoice[] = [];
    for (const i in ittModels) {
        const nameSplit = ittModels[i].split("/");
        ittOptions.push({
            name: nameSplit[nameSplit.length - 1],
            value: ittModels[i],
        });
    }
    const ittIndex = CommandObject.options.findIndex((v) => {
        return v.name === "itt";
    });
    const ittModelsIndex = CommandObject.options[ittIndex].options.findIndex(
        (v) => {
            return v.name === "model";
        }
    );
    CommandObject.options[ittIndex].options[ittModelsIndex].choices =
        ittOptions;

    // Set text-to-image model choices
    const ttiOptions: CommandOptionChoice[] = [];
    for (const i in ttiModels) {
        const nameSplit = ttiModels[i].split("/");
        ttiOptions.push({
            name: nameSplit[nameSplit.length - 1],
            value: ttiModels[i],
        });
    }
    const ttiIndex = CommandObject.options.findIndex((v) => {
        return v.name === "tti";
    });
    const ttiModelsIndex = CommandObject.options[ttiIndex].options.findIndex(
        (v) => {
            return v.name === "model";
        }
    );
    CommandObject.options[ttiIndex].options[ttiModelsIndex].choices =
        ttiOptions;

    return CommandObject;
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
    const modelOption = options.find((v) => v.name === "model");

    let modelSelected = modelOption?.value || ittModels[0];

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
            image: [...new Uint8Array(await blobdata.blob.arrayBuffer())],
            prompt: prompt,
            max_tokens: 512,
        };

        const res = await env.AI.run(modelSelected, input);

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
    const modelOption = options.find((v) => v.name === "model");

    let modelSelected = modelOption?.value || ttiModels[0];

    const blobdata = await blobFromOption(imgdata, interaction);

    const input: TTIInput = {
        prompt: prompt,
        strength: strength,
    };

    if (blobdata) {
        input.image = [...new Uint8Array(await blobdata.blob.arrayBuffer())];
    }

    const res = await env.AI.run(modelSelected, input);

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

export { CommandObject, ObjectInit, Execute };
