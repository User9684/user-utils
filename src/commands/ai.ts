import { isWhitelisted } from "../commands";
import {
    Attachment,
    ButtonCompontentType,
    CallbackType,
    Command,
    CommandOptionChoice,
    ComponentType,
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
    negative_prompt?: string;
    strength: number;
    image?: number[];
    image_b64?: string;
};

type FinetunesResponse = {
    success: boolean;
    result: {
        id: string;
        model: string;
        name: string;
        description: string;
    }[];
};

export type ChatData = {
    context: { role: string; content: string }[];
    model: string;
    system?: string;
    temp?: number;
    finetune?: string;
};

const chatModels = [
    "@cf/qwen/qwen1.5-7b-chat-awq",
    "@hf/nousresearch/hermes-2-pro-mistral-7b",
    "@cf/deepseek-ai/deepseek-math-7b-instruct",
    "@hf/google/gemma-7b-it",
    "@hf/mistral/mistral-7b-instruct-v0.2",
    "@hf/thebloke/llama-2-13b-chat-awq",
    "@hf/nexusflow/starling-lm-7b-beta",
];
const ittModels = [
    "@cf/unum/uform-gen2-qwen-500m",
    "@cf/llava-hf/llava-1.5-7b-hf",
];
const ttiModels = [
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    "@cf/bytedance/stable-diffusion-xl-lightning",
    "@cf/runwayml/stable-diffusion-v1-5-img2img",
    "@cf/runwayml/stable-diffusion-v1-5-inpainting",
    "@cf/lykon/dreamshaper-8-lcm",
];

const CommandObject: Command = {
    name: "ai",
    description: "Ai commands (WHITELIST ONLY)",
    options: [
        {
            type: OptionType.SUB_COMMAND,
            name: "chat",
            description: "Send a message to an LLM!",
            options: [
                {
                    type: OptionType.STRING,
                    name: "prompt",
                    description: "Prompt to give the AI",
                    required: true,
                },
                {
                    type: OptionType.STRING,
                    name: "system",
                    description: "System prompt to give the AI",
                },
                {
                    type: OptionType.NUMBER,
                    name: "temp",
                    description: "Randomness value (higher = more random)",
                    min_value: 0,
                    max_value: 5,
                },
                {
                    type: OptionType.STRING,
                    name: "model",
                    description: "AI model to use",
                },
                {
                    type: OptionType.STRING,
                    name: "finetune",
                    description:
                        "Fine tuned model to use (ignores model choice)",
                },
            ],
        },
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
                    type: OptionType.STRING,
                    name: "negative_prompt",
                    description: "Prompt for things to avoid generating",
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

async function ListFineTunes(env: Env) {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/finetunes/`,
        {
            headers: {
                Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN_AI}`,
            },
        }
    );

    const body: FinetunesResponse = await response.json();

    return body.result;
}

async function ObjectInit(env: Env): Promise<Command> {
    // Initialize option lists
    const chatOptions: CommandOptionChoice[] = [];
    const fineTunesOptions: CommandOptionChoice[] = [];
    const ittOptions: CommandOptionChoice[] = [];
    const ttiOptions: CommandOptionChoice[] = [];

    // Set chat model choices
    for (const i in chatModels) {
        const nameSplit = chatModels[i].split("/");
        chatOptions.push({
            name: nameSplit[nameSplit.length - 1],
            value: chatModels[i],
        });
    }
    // Set image-to-text model choices
    for (const i in ittModels) {
        const nameSplit = ittModels[i].split("/");
        ittOptions.push({
            name: nameSplit[nameSplit.length - 1],
            value: ittModels[i],
        });
    }
    // Set text-to-image model choices
    for (const i in ttiModels) {
        const nameSplit = ttiModels[i].split("/");
        ttiOptions.push({
            name: nameSplit[nameSplit.length - 1],
            value: ttiModels[i],
        });
    }

    // Set option list for chat
    const chatIndex = CommandObject.options.findIndex((v) => {
        return v.name === "chat";
    });
    const chatModelsIndex = CommandObject.options[chatIndex].options.findIndex(
        (v) => {
            return v.name === "model";
        }
    );
    CommandObject.options[chatIndex].options[chatModelsIndex].choices =
        chatOptions;

    // Set option list for image to text
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

    // Set option list for text to image
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

    // Set fine-tune list for chat
    const finetunes = await ListFineTunes(env);
    for (const i in finetunes) {
        const finetune = finetunes[i];

        fineTunesOptions.push({
            name: finetune.name,
            value: finetune.name,
        });
    }
    const finetunesIndex = CommandObject.options[chatIndex].options.findIndex(
        (v) => {
            return v.name === "finetune";
        }
    );
    CommandObject.options[chatIndex].options[finetunesIndex].choices =
        fineTunesOptions;

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
        case "chat":
            return await ExecuteChat(env, interaction, subcommandData, true);
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

export async function ExecuteChat(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption,
    freshConversation: boolean
): Promise<InteractionResponse> {
    let chatID = "";

    const options = subcommandData.options || [];
    const prompt = <string>options[0].value;
    let systemPromptOption = options.find((v) => v.name === "system");
    let tempOption = options.find((v) => v.name === "temp");
    let modelOption = options.find((v) => v.name === "model");
    let finetuneOption = options.find((v) => v.name === "finetune");

    const data: {
        messages: {}[];
        prompt?: string;
        temperature?: number;
        raw?: boolean;
        lora?: string;
    } = {
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    };
    let chatData: ChatData;

    if (!freshConversation) {
        chatID = [
            ...interaction.data.custom_id.match(/ai_reply_([a-z0-9]+)/i),
        ][1];

        const chatDataStr = await env.ai_history.get(chatID);
        if (chatDataStr == null) {
            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "This conversation has expired.",
                },
            };
        }

        chatData = JSON.parse(chatDataStr);
        systemPromptOption =
            (chatData.system && {
                name: "",
                value: chatData.system,
                type: OptionType.STRING,
            }) ||
            null;
        tempOption =
            (chatData.temp && {
                name: "",
                value: chatData.temp,
                type: OptionType.NUMBER,
            }) ||
            null;
        modelOption =
            (chatData.model && {
                name: "",
                value: chatData.model,
                type: OptionType.STRING,
            }) ||
            null;
        finetuneOption =
            (chatData.finetune && {
                name: "",
                value: chatData.finetune,
                type: OptionType.STRING,
            }) ||
            null;

        if (chatData.context.length > 0) {
            data.messages = chatData.context;
            data.prompt = prompt;
        }
    }

    let modelSelected = <string>modelOption?.value || chatModels[0];

    if (freshConversation) {
        chatID = interaction.id;
        chatData = {
            context: [],
            model: modelSelected,
        };
    }

    if (systemPromptOption) {
        data.messages.unshift({
            role: "system",
            content: <string>systemPromptOption.value,
        });
        chatData.system = <string>systemPromptOption.value;
    }

    if (tempOption) {
        data.temperature = <number>tempOption.value;
        chatData.temp = <number>tempOption.value;
    }

    if (finetuneOption) {
        const finetuneList = await ListFineTunes(env);
        const selectedFineTune = finetuneList.find(
            (f) => f.name == finetuneOption.value
        );

        modelSelected = selectedFineTune.model;
        data.raw = true;
        data.lora = selectedFineTune.id;
        chatData.finetune = <string>finetuneOption.value;
    }

    console.log(data);

    const res = await env.AI.run(modelSelected, data);

    if (res.response) {
        chatData.context.push(
            {
                role: "user",
                content: prompt,
            },
            {
                role: "assistant",
                content: res,
            }
        );
        env.ai_history.put(chatID, JSON.stringify(chatData), {
            expirationTtl: 60 * 5, // 5 minutes, keep chatting or convo gone.
        });
    }

    if (!res.response) {
        console.log(res);
    }

    let aiResponse = res.response || "No response given by AI";

    if (!freshConversation) {
        aiResponse = `> ${prompt}\n${aiResponse}`;
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: aiResponse,
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            label: "Reply",
                            custom_id: `ai_start_reply_${chatID}`,
                            style: ButtonCompontentType.Primary,
                        },
                        {
                            type: ComponentType.Button,
                            label: "View History",
                            custom_id: `ai_chat_history_${chatID}`,
                            style: ButtonCompontentType.Primary,
                        },
                    ],
                },
            ],
        },
    };
}

async function ExecuteITT(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const prompt = options[0].value as string;
    const imgdata = options.find((v) => v.name === "image" || v.name === "url");
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
    const negative_prompt = options.find((v) => v.name === "negative_prompt");
    const imgdata = options.find((v) => v.name === "image" || v.name === "url");
    const modelOption = options.find((v) => v.name === "model");

    let modelSelected = modelOption?.value || ttiModels[0];

    const blobdata = await blobFromOption(imgdata, interaction);

    const input: TTIInput = {
        prompt: prompt,
        strength: strength,
    };

    if (blobdata) {
        //input.image = [...new Uint8Array(await blobdata.blob.arrayBuffer())];
        input.image_b64 = await blobToBase64(blobdata.blob);
    }
    if (negative_prompt) {
        input.negative_prompt = <string>negative_prompt.value;
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
    const uri = await mediaUrlFromOption(option, interaction);
    if (!uri) {
        return null;
    }

    const blobdata = await BlobFromURL(uri);

    return blobdata;
}

async function mediaUrlFromOption(
    option: InteractionOption,
    interaction: Interaction
): Promise<string | null> {
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

    return uri;
}

async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    let str = "";

    new Uint8Array(buffer).forEach((byte) => {
        str += String.fromCharCode(byte);
    });

    return btoa(str);
}

export { CommandObject, ObjectInit, Execute };
