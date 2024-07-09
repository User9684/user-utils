"use strict";

import { embedAndComponentsFromRDAP } from "../commands/whois";
import { fetchRDAPData } from "../lib/RDAP";
import { DiscordRequest, application_id } from "../lib/discord";
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
    custom_id: "whois_next",
};

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
                return {
                    type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "This query has expired.",
                        flags: 64,
                    },
                };
            }

            const { token, query } = JSON.parse(queryJson);

            const messageResp = await DiscordRequest(
                env,
                `/webhooks/${application_id(env)}/${token}/messages/@original`,
                "GET"
            );

            const message: Message = await messageResp.json();

            const RDAPResponse = await fetchRDAPData(env, query);
            const { embeds, components } = await embedAndComponentsFromRDAP(
                RDAPResponse,
                "entities",
                Number(message.embeds[0].fields[0].value) +
                    ((interaction.data.custom_id === "whois_next" && 1) || -1),
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
        })()
    );

    return {
        type: CallbackType.IGNORE,
        data: {},
    };
}

export { ComponentObject, Execute };
