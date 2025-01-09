
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
    ParsedRDAP,
} from "../lib/RDAP";
import { RandomEmbedColor } from "../lib/discord";
import { ParseWhois, Whois, WhoisData } from "../lib/whois";

export async function parseCard(vcard: any[]): Promise<EmbedField> {
    const [name, parameters, type, value] = vcard;

    const valueString = Array.isArray(value) ? value.join(" ") : value;

    const paramStr = Object.entries(parameters)
        .map(([key, val]) => `${(key !== "type" && val) || ""}`)
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

        console.log(entity);

        const page: EmbedField[] = [];
        if (entity.roles) {
            page.push({
                name: "Role(s)",
                value: entity.roles.join(", "),
            });
        }

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

export async function embedAndComponentsFromInfo(
    RDAPResponse: FetchRDAPResponse | WhoisData,
    dataType: "RDAP" | "WHOIS",
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
            description: `Raw ${dataType} Response`,
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
                    value: `<t:${Math.trunc(
                        Date.parse(event.eventDate) / 1000
                    )}>`,
                });
            }
            break;
        case "ipinfo":
            const rdapData = <ParsedRDAP>(<FetchRDAPResponse>RDAPResponse).data;
            if (rdapData.rdaptype !== RDAPTypes.IP) {
                break;
            }

            const cidrs = [];

            for (const i in rdapData.cidr0_cidrs) {
                const cidr = rdapData.cidr0_cidrs[i];
                cidrs.push(`${cidr.v6prefix || cidr.v4prefix}/${cidr.length}`);
            }

            embedFields.push(
                {
                    name: "IP CIDR(s)",
                    value: `\`${cidrs.join("`, `")}\``,
                },
                {
                    name: "Block Name",
                    value: rdapData.name || "Undefined (Data Empty)",
                    inline: true,
                },
                {
                    name: "Ip Version",
                    value: rdapData.ipVersion || "Undefined (Data Empty)",
                },
                {
                    name: "Ip Country",
                    value: rdapData.country || "Undefined (Data Empty)",
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
        title: `${dataType} Response`,
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
        {
            type: OptionType.BOOLEAN,
            name: "skiprdap",
            description: "Whether or not to skip RDAP and directly check WHOIS",
            required: false,
        },
    ],
};

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const options = interaction?.data?.options;
    const input = options.find((v) => v.name === "domain");
    const skipRDAP = options.find((v) => v.name === "skiprdap");
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

    let whoisReason = '(Using WHOIS due to "skiprdap" being TRUE)';
    let rdapError = '"skiprdap" set to TRUE';

    if (!skipRDAP && !(<boolean>skipRDAP?.value)) {
        const RDAPResponse = await doRDAP(env, query, interaction);
        if (typeof RDAPResponse === "object") {
            return RDAPResponse;
        }

        whoisReason = `(Defaulted to WHOIS due to an error. \`${RDAPResponse}\`)`;
        rdapError = RDAPResponse;
    }

    const whoisResponse = await doWHOIS(env, query, interaction, whoisReason);

    if (typeof whoisResponse === "object") {
        return whoisResponse;
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: `Could not find any information for the given query.\nRDAP: \`${rdapError}\`\nWHOIS: \`${whoisResponse}\``,
        },
    };
}

async function doRDAP(
    env: Env,
    query: string,
    interaction: Interaction
): Promise<InteractionResponse | string> {
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

        const { embeds, components } = await embedAndComponentsFromInfo(
            RDAPResponse,
            "RDAP",
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

    return <string>RDAPResponse.data;
}

async function doWHOIS(
    env: Env,
    query: string,
    interaction: Interaction,
    reasonForWHOIS?: string
): Promise<InteractionResponse | string> {
    const WhoisResponse = await Whois(env, query);

    if (WhoisResponse.success) {
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

        try {
            const parsedWhois = await ParseWhois(
                WhoisResponse.response,
                WhoisResponse.whoisServer
            );

            // PUT whois into cache
            env.WHOISCache.put(query, JSON.stringify(parsedWhois), {
                expirationTtl: 60 * 8, // 8 minutes
            });


            const { embeds, components } = await embedAndComponentsFromInfo(
                WhoisResponse,
                "WHOIS",
                "ns",
                1,
                `Data fetched from ${WhoisResponse.whoisServer}`
            );
            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Got a response:tm:!",
                    embeds: embeds,
                    components: components,
                },
            };
        } catch (e) {
            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `Got a response:tm:!${
                        reasonForWHOIS && "\n" + reasonForWHOIS
                    }\n(Using raw response due to WHOIS library error. \`${e}\`)`,
                    attachments: [
                        {
                            blob: new Blob([WhoisResponse.response], {
                                type: "text/plain",
                            }),
                            fileName: "Whois_Response.txt",
                        },
                    ],
                },
            };
        }
    }

    return WhoisResponse.response;
}

export { CommandObject, Execute };
