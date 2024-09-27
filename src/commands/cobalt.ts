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
    Message,
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
const maxAttachmentsPerMessage = 10;

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

async function getCobaltData(
    url: string,
    env: Env
): Promise<Message | CobaltResponse> {
    const response = await fetch(cobaltURL, {
        headers: {
            "User-Agent": "9684 utilities bot",
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
            url: url,
        }),
    });

    const body: CobaltResponse = await response.json();

    if (body.status === "rate-limit") {
        return {
            content: `Currently ratelimited!`,
        };
    }
    if (body.status === "error") {
        return {
            content: `Something went wrong! \`${body.text}\``,
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
            content: `Unhandled error occured!${
                (env.BOT_OWNER &&
                    ` Please contact <@!${env.BOT_OWNER}> for further assistance.`) ||
                ""
            }`,
        };
    }

    return body;
}

async function uploadMedia(
    cobaltData: CobaltResponse,
    interaction: Interaction,
    env: Env
) {
    let failedUploads = 0;
    switch (cobaltData.status) {
        case "picker":
            let attachments: AttatchmentPartial[][] = [];

            const messagesNeeded = Math.ceil(
                cobaltData.picker.length / maxAttachmentsPerMessage
            );
            for (let i = 0; i < messagesNeeded; i++) {
                attachments.push([]);
            }

            let currentMessage = 0;

            let currentAttachment = 0;
            for (const i in cobaltData.picker) {
                const picked = cobaltData.picker[i];
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
                const res = await DiscordRequest(
                    env,
                    `/webhooks/${application_id(env)}/${interaction.token}`,
                    "POST",
                    followup
                );
                console.log(await res.text());

                if (res.status !== 200) {
                    failedUploads += 1;
                }
            }
            break;
        case "redirect":
        case "stream" || "redirct":
            if (!cobaltData.url) {
                return {
                    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `Cobalt did not return a URL!`,
                    },
                };
            }

            const fileData = await BlobFromURL(cobaltData.url);

            const followup = await FormFromPayload({
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    attachments: [
                        {
                            blob: fileData.blob,
                            fileName: fileData.filename,
                        },
                    ],
                },
            });

            const res = await DiscordRequest(
                env,
                `/webhooks/${application_id(env)}/${interaction.token}`,
                "POST",
                followup
            );

            if (res.status !== 200) {
                failedUploads += 1;
            }

            console.log(await res.text());
            break;
    }

    await DiscordRequest(
        env,
        `/webhooks/${application_id(env)}/${
            interaction.token
        }/messages/@original`,
        "PATCH",
        {
            content: `Finished uploading media! ${
                (failedUploads > 0 && `(${failedUploads} failed uploads)`) || ""
            }`,
        }
    );
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

async function Execute(
    env: Env,
    interaction: Interaction,
    ctx: Ctx
): Promise<InteractionResponse> {
    const urlOption = interaction?.data?.options?.[0];
    if (!urlOption || !urlOption.value || typeof urlOption.value !== "string") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Erm, what the sigma?`,
            },
        };
    }

    const url: string = urlOption.value;

    ctx.waitUntil(
        (async () => {
            const cobaltResponse = await getCobaltData(url, env);
            // Not sure of any better way I could do this besides using a class instead
            if (typeof (<CobaltResponse>cobaltResponse).status !== "string") {
                await DiscordRequest(
                    env,
                    `/webhooks/${application_id(env)}/${
                        interaction.token
                    }/messages/@original`,
                    "PATCH",
                    cobaltResponse
                );

                return;
            }

            await DiscordRequest(
                env,
                `/webhooks/${application_id(env)}/${
                    interaction.token
                }/messages/@original`,
                "PATCH",
                {
                    content: "Downloading media... (This may take awhile)",
                }
            );

            await uploadMedia(<CobaltResponse>cobaltResponse, interaction, env);
        })()
    );

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Sending request... (This may take awhile)",
        },
    };
}

export { CommandObject, Execute };
