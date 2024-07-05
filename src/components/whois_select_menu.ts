"use strict";

import { embedAndComponentsFromRDAP } from "../commands/whois";
import { fetchRDAPData } from "../lib/RDAP";
import { DiscordRequest, application_id } from "../lib/discord";
import {
    CallbackType,
    ComponentObject,
    Env,
    Interaction,
    InteractionResponse,
    Message,
} from "../types";

const ComponentObject: ComponentObject = {
    custom_id: "whois_select_menu",
};

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const queryJson = await env.MessageQueries.get(
        interaction.message.interaction_metadata.id
    );
    if (queryJson === null) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "This query has expired.",
                flags: 64,
            },
        };
    }

    const { token, query } = JSON.parse(queryJson);

    const RDAPResponse = await fetchRDAPData(env, query);

    if (typeof RDAPResponse.data !== "object") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "This query has expired.",
                flags: 64,
            },
        };
    }

    const selectedValue = (interaction.data.values || [])[0];

    switch (selectedValue) {
        case "ns":
        case "events":
        case "ipinfo":
        case "entities" || "ns" || "events" || "ipinfo":
            const { embeds, components } = await embedAndComponentsFromRDAP(
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
                `/webhooks/${application_id(env)}/${token}/messages/@original`,
                "PATCH",
                responseMessage
            );

            break;
        case "raw":
            return {
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
            };
    }

    return {
        type: CallbackType.UPDATE_MESSAGE,
        data: {},
    };
}

export { ComponentObject, Execute };
