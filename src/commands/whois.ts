"use strict";

import { connect } from "cloudflare:sockets";
import {
    ButtonCompontentType,
    CallbackType,
    Command,
    ComponentType,
    Embed,
    EmbedField,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
    RowComponent,
    SelectMenuComponentOption,
} from "../types";
import {
    FetchRDAPResponse,
    RDAPTypes,
    fetchRDAPData,
    Entity,
} from "../lib/RDAP";
import { RandomEmbedColor } from "../lib/discord";

export async function parseCard(vcard: any[]): Promise<EmbedField> {
    const [name, parameters, type, value] = vcard;

    const valueString = Array.isArray(value) ? value.join(" ") : value;

    const paramStr = Object.entries(parameters)
        .map(([_, val]) => `${val}`)
        .join("; ");

    let cardValue: string;

    switch (type) {
        case "text":
            cardValue = (
                (paramStr && paramStr?.length >= 0 && paramStr) ||
                valueString
            ).replaceAll("\n", " ");
            break;
        case "uri":
            cardValue = value;
    }

    return {
        name: name,
        value: (cardValue.length > 0 && cardValue) || "No value :/",
    };
}

export async function pagesFromEntities(
    entities: Entity[]
): Promise<EmbedField[][]> {
    const pages: EmbedField[][] = [];

    for (const i in entities) {
        const entity = entities[i];

        const page: EmbedField[] = [
            {
                name: "Role(s)",
                value: entity.roles.join(", "),
            },
        ];
        for (const ci in entity.vcardArray[1]) {
            const value = entity.vcardArray[1][ci];
            const card = await parseCard(value);

            page.push(card);
        }

        pages.push(page);

        const subEntities = await pagesFromEntities(entity.entities || []);
        for (const i in subEntities) {
            pages.push(subEntities[i]);
        }
    }

    return pages;
}

export async function embedAndComponentsFromRDAP(
    RDAPResponse: FetchRDAPResponse,
    type: "ns" | "entities" | "events" | "ipinfo",
    page: number,
    footerStr: string
): Promise<{
    embeds: Embed[];
    components: RowComponent[];
}> {
    const embeds: Embed[] = [];
    const components: RowComponent[] = [];

    if (!RDAPResponse.success || typeof RDAPResponse.data !== "object") {
        return {
            embeds,
            components,
        };
    }

    const menuOptions: SelectMenuComponentOption[] = [
        {
            label: "Raw Response",
            value: "raw",
            description: "Raw RDAP Response",
        },
    ];

    const embedFields: EmbedField[] = [];
    switch (RDAPResponse.data.rdaptype) {
        case RDAPTypes.IP:
            menuOptions.push(
                {
                    label: "IP Info",
                    value: "ipinfo",
                    description: "IP Information (CIDR, name, country)",
                },
                {
                    label: "IP Events",
                    value: "events",
                    description:
                        "IP registration events (registration, changes, etc)",
                }
            );

            if (RDAPResponse.data.entities?.length > 0) {
                menuOptions.push({
                    label: "Entities",
                    value: "entities",
                    description: "IP Entities",
                });
            }
            break;
        case RDAPTypes.DOMAIN:
            menuOptions.push(
                {
                    label: "Name Servers",
                    value: "ns",
                    description: "Domain nameservers",
                },
                {
                    label: "Domain Events",
                    value: "events",
                    description:
                        "Domain registration events (expiration, registration, etc)",
                }
            );

            if (RDAPResponse.data.entities?.length > 0) {
                menuOptions.push({
                    label: "Entities",
                    value: "entities",
                    description: "Domain Entities",
                });
            }
            break;
    }

    switch (type) {
        case "ns":
            const nameservers = (
                (RDAPResponse.data.rdaptype === RDAPTypes.DOMAIN &&
                    RDAPResponse.data.nameservers) ||
                []
            ).map((v) => {
                return v.ldhName.toLowerCase() + " ";
            });
            embedFields.push({
                name: "Name Servers",
                value: `\`\`\`fix\n${nameservers.join("\n")}\`\`\``,
            });
            break;
        case "entities":
            embedFields.push({
                name: "Entity Number",
                value: page.toString(),
            });
            const fields = await pagesFromEntities(RDAPResponse.data.entities);

            page = Math.min(Math.max(page, 1), fields?.length);

            const pageFields = fields[page - 1];

            console.log(pageFields);

            for (const i in pageFields) {
                embedFields.push(pageFields[i]);
            }

            components.push({
                type: 1,
                components: [
                    {
                        type: 2,
                        style: ButtonCompontentType.Primary,
                        label: "←",
                        custom_id: "whois_previous",
                        disabled: page <= 1,
                    },
                    {
                        type: 2,
                        style: ButtonCompontentType.Primary,
                        label: "→",
                        custom_id: "whois_next",
                        disabled: page >= fields?.length,
                    },
                ],
            });
            break;
        case "events":
            for (const i in RDAPResponse.data.events) {
                const event = RDAPResponse.data.events[i];

                embedFields.push({
                    name: event.eventAction,
                    value: `<t:${Date.parse(event.eventDate) / 1000}>`,
                });
            }
            break;
        case "ipinfo":
            if (RDAPResponse.data.rdaptype !== RDAPTypes.IP) {
                break;
            }

            const cidrs = [];

            for (const i in RDAPResponse.data.cidr0_cidrs) {
                const cidr = RDAPResponse.data.cidr0_cidrs[i];
                cidrs.push(`${cidr.v6prefix || cidr.v4prefix}/${cidr.length}`);
            }

            embedFields.push(
                {
                    name: "IP CIDR(s)",
                    value: `\`${cidrs.join("`, `")}\``,
                },
                {
                    name: "Block Name",
                    value: RDAPResponse.data.name,
                    inline: true,
                },
                {
                    name: "Ip Version",
                    value: RDAPResponse.data.ipVersion,
                },
                {
                    name: "Ip Country",
                    value: RDAPResponse.data.country,
                }
            );
            break;
    }

    components.push({
        type: 1,
        components: [
            {
                type: ComponentType.StringSelect,
                custom_id: "whois_select_menu",
                options: menuOptions,
            },
        ],
    });

    embeds.push({
        title: "RDAP Response",
        fields: embedFields,
        footer: {
            text: footerStr,
        },
        color: RandomEmbedColor(),
    });

    return {
        embeds,
        components,
    };
}

const CommandObject: Command = {
    name: "whois",
    description: "Request RDAP/Whois data for a specific domain",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.STRING,
            name: "domain",
            description: "Domain to get info for",
            required: true,
        },
    ],
};

async function Whois(query: string): Promise<string | undefined> {
    const whoisQuery = new TextEncoder().encode(query + "\r\n");

    const socket = connect("whois.iana.org:43");
    const writer = socket.writable.getWriter();
    await writer.write(whoisQuery);

    const res = new Response(socket.readable);
    const text = await res.text();
    socket.close();

    if (text.includes("This query returned 0 objects")) {
        return;
    }
    if (text.includes("Error: Invalid query")) {
        return;
    }

    return text;
}

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const input = interaction?.data?.options?.[0];
    if (!input) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No input given",
                flags: 64,
            },
        };
    }

    const query = input.value
        .toString()
        .replace(" ", "")
        .replace("\n", "")
        .replace("\r", "")
        .toLowerCase();

    const RDAPResponse = await fetchRDAPData(env, query);
    if (RDAPResponse.success && typeof RDAPResponse.data === "object") {
        await env.MessageQueries.put(
            interaction.id,
            JSON.stringify({
                token: interaction.token,
                query: query,
            }),
            {
                expirationTtl: 60 * 8, // 8 minutes
            }
        );

        const embedFields: EmbedField[] = [];
        if (RDAPResponse.data.rdaptype === RDAPTypes.DOMAIN) {
            const nameservers = (RDAPResponse.data.nameservers || []).map(
                (v) => {
                    return v.ldhName.toLowerCase() + " ";
                }
            );
            embedFields.push({
                name: "Name Servers",
                value: `\`\`\`fix\n${nameservers.join("\n")}\`\`\``,
            });
        }

        const { embeds, components } = await embedAndComponentsFromRDAP(
            RDAPResponse,
            (RDAPResponse.data.rdaptype === RDAPTypes.DOMAIN && "ns") ||
                "ipinfo",
            1,
            `Data fetched from ${RDAPResponse.rdapServer}`
        );

        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Got a response:tm:!",
                embeds: embeds,
                components: components,
            },
        };
    }

    const WhoisResponse = await Whois(input.value.toString());
    if (WhoisResponse) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `Got a response:tm:!\n(Defaulted to WHOIS due to an error. \`${RDAPResponse.data}\`)`,
                attachments: [
                    {
                        blob: new Blob([WhoisResponse], {
                            type: "text/plain",
                        }),
                        fileName: "Whois_Response.txt",
                    },
                ],
            },
        };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Could not find any information for the given query.",
        },
    };
}

export { CommandObject, Execute };
