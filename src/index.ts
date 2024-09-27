"use strict";

import {
    CallbackType,
    Ctx,
    Env,
    Interaction,
    InteractionCallback,
    InteractionResponse,
    InteractionType,
} from "./types";
import {
    DiscordRequest,
    FormFromPayload,
    VerifyRequest,
    application_id,
} from "./lib/discord";
import { commands, components } from "./commands";

async function handleInteraction(
    interaction: Interaction,
    env: Env,
    ctx: Ctx
): Promise<InteractionResponse> {
    switch (interaction.type) {
        case InteractionType.MESSAGE_COMPONENT:
        case InteractionType.APPLICATION_COMMAND ||
            InteractionType.MESSAGE_COMPONENT:
            try {
                const cmd =
                    (interaction.type === InteractionType.APPLICATION_COMMAND &&
                        commands[interaction.data.name]) ||
                    components[interaction.data.custom_id];

                if (!cmd) {
                    return {
                        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: `No ${
                                (interaction.type ===
                                    InteractionType.APPLICATION_COMMAND &&
                                    "command") ||
                                "component code"
                            } found for \`${
                                interaction.data.name ||
                                interaction.data.custom_id
                            }\``,
                            flags: 64,
                        },
                    };
                }
                const commandResponse = await cmd.Execute(
                    env,
                    interaction,
                    ctx
                );

                return commandResponse;
            } catch (err) {
                const response: InteractionResponse = {
                    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "Command errored!",
                        flags: 64,
                    },
                };

                const userID =
                    interaction?.member?.user?.id ||
                    interaction?.user?.id ||
                    "";

                if (userID === env.BOT_OWNER && response.data) {
                    response.data.attachments = [
                        {
                            blob: new Blob([err], {
                                type: "text/plain",
                            }),
                            fileName: "error.txt",
                        },
                    ];
                }

                return response;
            }
        default:
            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `Interaction type \`${interaction.type}\` is not supported.`,
                    flags: 64,
                },
            };
    }
}

export default {
    async fetch(request: Request, env: Env, ctx: Ctx) {
        const url = new URL(request.url);

        if (url.pathname !== "/interactions") {
            return Response.redirect(
                "https://github.com/User9684/user-utils",
                301
            );
        }

        const verified = await VerifyRequest(request, env);
        if (!verified) {
            return new Response("erm, no???", {
                status: 401,
            });
        }

        const requestBody: Interaction = await request.json();

        if (requestBody.type === InteractionType.PING) {
            return Response.json({
                type: CallbackType.PONG,
            });
        }

        // Debugging sent to Cloudflare temporary logs, no data is stored.
        if (env.INTERACTION_DEBUG) {
            const userID =
                requestBody?.member?.user?.id || requestBody?.user?.id || "";
            const optionsStr = (requestBody.data.options || [])
                .map((option) => `${option.name}: ${option.value}`)
                .join(", ");

            console.log(
                `User ${userID} executed command/component ${
                    requestBody.data.custom_id || requestBody.data.name
                }\nChannel: ${requestBody.channel_id}\nInteraction ID:${
                    requestBody.id
                }\nArgs: ${optionsStr}`
            );
        }

        ctx.waitUntil(
            (async () => {
                const response = await handleInteraction(requestBody, env, ctx);

                if (response.type === CallbackType.IGNORE) {
                    return;
                }

                const form = await FormFromPayload(response);
                const res = await DiscordRequest(
                    env,
                    `/webhooks/${application_id(env)}/${
                        requestBody.token
                    }/messages/@original`,
                    "PATCH",
                    form
                );

                console.log(await res.text());
            })()
        );

        if (requestBody.type === InteractionType.MESSAGE_COMPONENT) {
            return Response.json({
                type: CallbackType.UPDATE_MESSAGE,
                data: {},
            });
        }

        return Response.json({
            type: CallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
    },
};
