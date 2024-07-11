"use strict";

import { embedAndComponentsFromRDAP } from "../commands/whois";
import { fetchRDAPData } from "../lib/RDAP";
import {
    DiscordRequest,
    FormFromPayload,
    application_id,
} from "../lib/discord";
import {
    CallbackType,
    ComponentObject,
    Ctx,
    Env,
    Interaction,
    InteractionResponse,
    Message,
} from "../types";

const ComponentObject: ComponentObject = {
    custom_id: "whois_select_menu",
};

export async function expireMessage(env: Env, interaction: Interaction) {
    const followup = await FormFromPayload({
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "This query has expired.",
            flags: 64,
        },
    });
    await DiscordRequest(
        env,
        `/webhooks/${application_id(env)}/${interaction.token}`,
        "POST",
        followup
    );
}

async function Execute(
    env: Env,
    interaction: Interaction,
    ctx: Ctx
): Promise<InteractionResponse> {
    ctx.waitUntil(
        (async () => {
            const queryJson = await env.MessageQueries.get(
                interaction.message.interaction_metadata.id
            );
            if (queryJson === null) {
                return await expireMessage(env, interaction);
            }

            const { token, query } = JSON.parse(queryJson);

            const RDAPResponse = await fetchRDAPData(env, query);

            if (typeof RDAPResponse.data !== "object") {
                return await expireMessage(env, interaction);
            }

            const selectedValue = (interaction.data.values || [])[0];

            switch (selectedValue) {
                case "ns":
                case "events":
                case "ipinfo":
                case "entities" || "ns" || "events" || "ipinfo":
                    const { embeds, components } =
                        await embedAndComponentsFromRDAP(
                            RDAPResponse,
                            selectedValue,
                            1,
                            interaction.message.embeds[0].footer.text
                        );

                    const responseMessage: Message = {
                        content: interaction.message.content,
                        embeds: embeds,
                        components: components,
                    };

                    await DiscordRequest(
                        env,
                        `/webhooks/${application_id(
                            env
                        )}/${token}/messages/@original`,
                        "PATCH",
                        responseMessage
                    );

                    break;
                case "raw":
                    const followup = await FormFromPayload({
                        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            attachments: [
                                {
                                    blob: new Blob(
                                        [
                                            JSON.stringify(
                                                RDAPResponse.data.raw,
                                                null,
                                                4
                                            ),
                                        ] /* Make the JSON prettier */,
                                        {
                                            type: "text/plain",
                                        }
                                    ),
                                    fileName: "RDAP_Response.txt",
                                },
                            ],
                        },
                    });
                    await DiscordRequest(
                        env,
                        `/webhooks/${application_id(env)}/${token}`,
                        "POST",
                        followup
                    );
                    break;
            }
        })()
    );

    return {
        type: CallbackType.IGNORE,
        data: {},
    };
}

export { ComponentObject, Execute };
