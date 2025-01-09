
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
    Command_Type,
} from "../types";
import { CobaltHeaders, CobaltResponse, GetCobaltData } from "../lib/cobalt";

const urlRegex =
    /https?:\/\/(?:www\.)?([-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,}\b)*(\/[\/\d\w\.-]*)*(?:[\?])*([^ \n]+)*/gi;

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

const maxAttachmentsPerMessage = 10;

type BlobData = {
    blob: Blob;
    filename: string;
};

function isCobaltURL(env: Env, url: string) {
    const baseHost = new URL(env.COBALT_URL).hostname;
    const givenHost = new URL(url).hostname;

    console.log(baseHost);
    console.log(givenHost);
    console.log(baseHost == givenHost);
    return baseHost == givenHost;
}

async function uploadMedia(
    cobaltData: CobaltResponse,
    interaction: Interaction,
    env: Env
): Promise<boolean> {
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
                const fileData = await BlobFromURL(
                    env,
                    picked.url,
                    isCobaltURL(env, picked.url)
                );

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
        case "tunnel":
        case "stream":
            if (!cobaltData.url) {
                return false;
            }

            const fileData = await BlobFromURL(
                env,
                cobaltData.url,
                isCobaltURL(env, cobaltData.url)
            );

            if (fileData.blob.size <= 10) {
                console.log("File size too small!");
                return false;
            }

            if (fileData.filename.includes("html")) {
                console.log("Invalid media type!");
                console.log(await fileData.blob.text());
                return false;
            }

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
            content: `Finished uploading media!${
                (failedUploads > 0 && `( ${failedUploads} failed uploads)`) ||
                ""
            }`,
        }
    );

    return true;
}

async function BlobFromURL(
    env: Env,
    url: string,
    shouldUseCobaltHeaders: boolean
): Promise<BlobData> {
    const headers =
        (shouldUseCobaltHeaders && (await CobaltHeaders(env, "*/*"))) || {};

    console.log(JSON.stringify(headers));

    const mediaResponse = await fetch(url, {
        headers: headers,
    });

    let fileExtension = "";
    const cd = mediaResponse.headers.get("content-disposition");
    const ct = mediaResponse.headers.get("content-type");
    if (cd) {
        const dotSplit = cd.split(".")
        fileExtension = dotSplit[dotSplit.length-1].split('"')[0];
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
    let uri = "";
    switch (interaction.data.type) {
        case Command_Type.CHAT_INPUT:
            const urlOption = interaction?.data?.options?.[0];
            if (
                !urlOption ||
                !urlOption.value ||
                typeof urlOption.value !== "string"
            ) {
                return {
                    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `Erm, what the sigma?`,
                    },
                };
            }

            uri = urlOption.value;
            break;
        case Command_Type.MESSAGE:
            const message: string =
                interaction.data.resolved.messages[interaction.data.target_id]
                    .content;

            const res = urlRegex.exec(message);
            if (!res) {
                await DiscordRequest(
                    env,
                    `/webhooks/${application_id(env)}/${
                        interaction.token
                    }/messages/@original`,
                    "PATCH",
                    {
                        content: "No valid URLs found in message!",
                    }
                );
                return;
            }

            uri = res[0];
    }

    ctx.waitUntil(
        (async () => {
            const cobaltResponse = await GetCobaltData(env, uri);

            if (typeof cobaltResponse == "string") {
                console.log("Update message with error");
                const res = await DiscordRequest(
                    env,
                    `/webhooks/${application_id(env)}/${
                        interaction.token
                    }/messages/@original`,
                    "PATCH",
                    {
                        content: `Could not fetch content from cobalt!\n\`${cobaltResponse}\``,
                    }
                );

                console.log(await res.text());

                return;
            }

            if (typeof (<CobaltResponse>cobaltResponse).status !== "string") {
                await DiscordRequest(
                    env,
                    `/webhooks/${application_id(env)}/${
                        interaction.token
                    }/messages/@original`,
                    "PATCH",
                    {
                        content: "Something went wrong!",
                    }
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

            const uploadSuccess = await uploadMedia(
                <CobaltResponse>cobaltResponse,
                interaction,
                env
            );

            if (uploadSuccess) {
                return;
            }

            await DiscordRequest(
                env,
                `/webhooks/${application_id(env)}/${
                    interaction.token
                }/messages/@original`,
                "PATCH",
                {
                    content: "Couldn't fetch media from cobalt!",
                }
            );
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
