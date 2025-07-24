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
import { commands, components, modals } from "./commands";

function commandFromInteraction(interaction: Interaction) {
    let cmd =
        (interaction.type === InteractionType.APPLICATION_COMMAND &&
            commands[interaction.data.name]) ||
        (interaction.type === InteractionType.MESSAGE_COMMAND &&
            commands[interaction.data.name]) ||
        (interaction.type === InteractionType.MESSAGE_COMPONENT &&
            components[interaction.data.custom_id]) ||
        (interaction.type === InteractionType.MODAL_SUBMIT &&
            modals[interaction.data.custom_id]);

    // this is the single handedly worst logic ive every written in my life
    if (
        !cmd &&
        (interaction.type == InteractionType.MESSAGE_COMPONENT ||
            interaction.type == InteractionType.MODAL_SUBMIT)
    ) {
        for (const id in components) {
            const component = components[id];
            if (
                component.ComponentObject.custom_id instanceof RegExp &&
                interaction.data.custom_id.match(
                    component.ComponentObject.custom_id
                )
            ) {
                cmd = component;
                break;
            }
        }

        for (const id in modals) {
            const modal = modals[id];
            if (
                modal.ModalObject.custom_id instanceof RegExp &&
                interaction.data.custom_id.match(modal.ModalObject.custom_id)
            ) {
                cmd = modal;
                break;
            }
        }
    }

    return cmd;
}

// NOT EVEN GOD KNOWS HOW THIS WORKS.
async function handleInteraction(
    interaction: Interaction,
    env: Env,
    ctx: Ctx
): Promise<InteractionResponse> {
    console.log(interaction);
    const cmd = commandFromInteraction(interaction);

    switch (interaction.type) {
        case InteractionType.MODAL_SUBMIT:
        case InteractionType.MESSAGE_COMPONENT:
        case InteractionType.MESSAGE_COMMAND:
        case InteractionType.APPLICATION_COMMAND:
            try {
                const commandResponse = await cmd.Execute(
                    env,
                    interaction,
                    ctx
                );

                return commandResponse;
            } catch (err) {
                console.log(err);
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

        const foundCommand = commandFromInteraction(requestBody);

        if (foundCommand && foundCommand.instant_execution) {
            const response = await handleInteraction(requestBody, env, ctx);

            return Response.json(response);
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
