"use strict";

import {
    CallbackType,
    Env,
    Interaction,
    InteractionResponse,
    InteractionType,
} from "./types";
import { FormFromPayload, VerifyRequest } from "./lib/discord";
import { commands, components } from "./commands";

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);

        if (url.pathname !== "/interactions") {
            return new Response("Fuck off.", {
                status: 418,
            });
        }

        const verified = await VerifyRequest(request, env);
        if (!verified) {
            return new Response("erm, no???", {
                status: 401,
            });
        }

        const requestBody: Interaction = await request.json();

        switch (requestBody.type) {
            case InteractionType.PING:
                return Response.json({
                    type: 1,
                });
            case InteractionType.MESSAGE_COMPONENT:
            case InteractionType.APPLICATION_COMMAND ||
                InteractionType.MESSAGE_COMPONENT:
                try {
                    const cmd =
                        (requestBody.type ===
                            InteractionType.APPLICATION_COMMAND &&
                            commands[requestBody.data.name]) ||
                        components[requestBody.data.custom_id];

                    if (!cmd) {
                        return Response.json({
                            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `No ${
                                    (requestBody.type ===
                                        InteractionType.APPLICATION_COMMAND &&
                                        "command") ||
                                    "component code"
                                } found for \`${
                                    requestBody.data.name ||
                                    requestBody.data.custom_id
                                }\``,
                                flags: 64,
                            },
                        });
                    }
                    const commandResponse = await cmd.Execute(env, requestBody);

                    const response = await FormFromPayload(commandResponse);

                    return new Response(response);
                } catch (err) {
                    const response: InteractionResponse = {
                        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: "Command errored!",
                            flags: 64,
                        },
                    };

                    const userID =
                        requestBody?.member?.user?.id ||
                        requestBody?.user?.id ||
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

                    return new Response(await FormFromPayload(response));
                }
            default:
                return Response.json({
                    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `Interaction type \`${requestBody.type}\` is not supported.`,
                        flags: 64,
                    },
                });
        }
    },
};
