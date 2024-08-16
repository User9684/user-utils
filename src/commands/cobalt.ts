"use strict";

import {
    application_id,
    DiscordRequest,
    FormFromPayload,
} from "../lib/discord";
import {
    AttatchmentPartial,
    CallbackType,
    Command,
    Ctx,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";

const CommandObject: Command = {
    name: "cobalt",
    description: "Download media from a website via cobalt.tools",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.STRING,
            name: "url",
            description: "URL to fetch video from",
            required: true,
        },
    ],
};

const cobaltURL = "https://api.cobalt.tools/api/json";
const maxAttachmentsPerMessage = 10

type CobaltPicker = {
    type?: "video" | "photo" | "gif";
    url: string;
    thumb?: string;
};

type CobaltResponse = {
    status:
        | "error"
        | "redirect"
        | "stream"
        | "success"
        | "rate-limit"
        | "picker";
    text?: string;
    url?: string;
    pickerType?: "various" | "images";
    picker?: CobaltPicker[];
    audio?: string;
};

type BlobData = {
    blob: Blob;
    filename: string;
};

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

async function Execute(
    env: Env,
    interaction: Interaction,
    ctx: Ctx
): Promise<InteractionResponse> {
    const url = interaction?.data?.options?.[0];
    if (!url || !url.value) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Erm, what the sigma?`,
            },
        };
    }

    const response = await fetch(cobaltURL, {
        headers: {
            "User-Agent": "9684 utilities bot",
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
            url: url.value,
        }),
    });

    const body: CobaltResponse = await response.json();

    if (body.status === "rate-limit") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Currently ratelimited!`,
            },
        };
    }
    if (body.status === "error") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Something went wrong! \`${body.text}\``,
            },
        };
    }
    if (
        !(
            body.status === "picker" ||
            body.status === "redirect" ||
            body.status == "stream"
        )
    ) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Unhandled error occured!`,
            },
        };
    }

    switch (body.status) {
        case "picker":
            ctx.waitUntil(
                (async () => {
                    let attachments: AttatchmentPartial[][] = [];

                    const messagesNeeded = Math.ceil(body.picker.length / maxAttachmentsPerMessage);
                    for (let i = 0; i < messagesNeeded; i++) {
                        attachments.push([]);
                    }

                    let currentMessage = 0;

                    let currentAttachment = 0;
                    for (const i in body.picker) {
                        const picked = body.picker[i];
                        const fileData = await BlobFromURL(picked.url);

                        attachments[currentMessage].push({
                            blob: fileData.blob,
                            fileName: fileData.filename,
                        });
                        if ((currentAttachment + 1) % maxAttachmentsPerMessage === 0) {
                            currentMessage += 1;
                        }
                        currentAttachment += 1;
                    }

                    for (const i in attachments) {
                        const message = attachments[i];
                        const followup = await FormFromPayload({
                            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `Attachments ${
                                    Number(i) + 1
                                }/${messagesNeeded}`,
                                attachments: message,
                            },
                        });
                        await DiscordRequest(
                            env,
                            `/webhooks/${application_id(env)}/${
                                interaction.token
                            }`,
                            "POST",
                            followup
                        );
                    }
                })()
            );

            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Fetching attachments... (This may take awhile)",
                },
            };
        case "redirect":
        case "stream" || "redirct":
            if (!body.url) {
                return {
                    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `Cobalt did not return a URL!`,
                    },
                };
            }

            const fileData = await BlobFromURL(body.url);

            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    attachments: [
                        {
                            blob: fileData.blob,
                            fileName: fileData.filename,
                        },
                    ],
                    flags: 64,
                },
            };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: `Sigma skibidi balls`,
        },
    };
}

export { CommandObject, Execute };
