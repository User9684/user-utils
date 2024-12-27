import { connect } from "cloudflare:sockets";
import { Entity, RDAPTypes } from "./RDAP";
import { Env } from "../types";

const ianaWhois = "whois.iana.org";
const whoisTimeout = 5 * 1000;

const referRegex = /refer:\s+(.+)/;
const nsRegex = /Name\s*Server:\s*(.+)/;
const statusRegex = /(?:Domain )?Status: .+/g;
const eventsRegex =
    /((?:\w| |-)+)(?: (?:Date|[oO]n))?:? +(\d+-\d+-\d+(?:(?: |T)\d+:\d+:\d+)?(?:\w+)?)/g;
const entityRegex =
    /^\s*(?<section>\w+)(?: (?<key>[^:\n]+))?: ?(?<value>.*)$/gm;
// eventually cloudflare might support backreferencing but ATM they dont so this is useless
const firstEntityRegex = /^\s*(?<section>\w+)(?: [^:\n]+):.+\n\s*/m;

export type WhoisData = {
    success: boolean;
    response: string;
    whoisServer?: string;
    data?: {
        raw: string;
        rdaptype: RDAPTypes;
        events: { eventAction: string; eventDate: string }[];
        nameservers: { ldhName: string }[];
        entities: Entity[];
    };
};

async function timeoutPromise(promise: Promise<any>, timeout: number) {
    const timeoutPromise = new Promise((resolve, _) => {
        setTimeout(() => {
            resolve("Timeout");
        }, timeout);
    });

    return await Promise.race([promise, timeoutPromise]);
}

async function whoisRequest(query: string, domain: string): Promise<string> {
    const whoisQuery = new TextEncoder().encode(query);

    const socket = connect(domain + ":43");

    const connectionOpened = await timeoutPromise(socket.opened, whoisTimeout);

    if (connectionOpened === "Timeout") {
        socket.close();
        return "Timeout";
    }
    console.log(`connected to ${domain}:43`);

    const writer = socket.writable.getWriter();
    const writeTimeout = await timeoutPromise(
        writer.write(whoisQuery),
        whoisTimeout
    );

    if (writeTimeout === "Timeout") {
        socket.close();
        return "Timeout";
    }
    console.log(`wrote request to ${domain}:43`);

    const res = new Response(socket.readable);
    const text = await timeoutPromise(res.text(), whoisTimeout);
    if (text === "Timeout") {
        socket.close();
        return "Timeout";
    }
    socket.close();

    return text;
}

function whoisResponseChecks(text: string) {
    if (text.includes("This query returned 0 objects")) {
        return {
            success: false,
            response:
                "WHOIS server returned no results. Is this a valid domain?",
        };
    }
    if (text.includes("Error: Invalid query")) {
        return {
            success: false,
            response: "Invalid WHOIS query",
        };
    }
    if (text.includes("Timeout")) {
        return {
            success: false,
            response: "WHOIS server timed out",
        };
    }

    return true;
}

export async function Whois(env: Env, query: string): Promise<WhoisData> {
    const cachedJSON = await env.WHOISCache.get(query);
    if (cachedJSON !== null) {
        return JSON.parse(cachedJSON);
    }

    const text = await whoisRequest(query + "\r\n", ianaWhois);
    const validWhois = whoisResponseChecks(text);
    if (typeof validWhois === "object") {
        return validWhois;
    }

    const refer = referRegex.exec(text);

    if (!refer || refer.length <= 1) {
        return {
            success: true,
            response: text,
        };
    }

    const text2 = await whoisRequest(query + "\r\n", refer[1]);
    const validWhois2 = whoisResponseChecks(text2);
    if (typeof validWhois2 === "object") {
        return validWhois2;
    }

    return {
        success: true,
        response: text2,
        whoisServer: refer[1],
    };
}

export async function ParseWhois(
    data: string,
    server: string
): Promise<WhoisData> {
    const parsedNameservers: { ldhName: string }[] = [];
    const parsedEvents: { eventAction: string; eventDate: string }[] = [];
    const parsedEntities: { [id: string]: { [id: string]: string } } = {};

    // Parse nameservers in WHOIS data
    const nameservers = [...data.matchAll(new RegExp(nsRegex, "g"))];
    for (const i in nameservers) {
        parsedNameservers.push({ ldhName: nameservers[i][1] });
    }

    // Parse events in WHOIS data (with only the worst regex i've ever written lol)
    const events = [...data.matchAll(eventsRegex)];
    for (const i in events) {
        const match = events[i];
        parsedEvents.push({
            eventAction: match[1],
            eventDate: match[2],
        });
    }

    const nsIndex = data.match(nsRegex).index;

    const entitiesSection = data
        .slice(0, nsIndex)
        .replaceAll(eventsRegex, "")
        .replaceAll(statusRegex, "");

    // Parse entities from section
    const entities = [...entitiesSection.matchAll(entityRegex)];
    for (const i in entities) {
        const match = entities[i];
        const entityTitle = match[1];
        let entityKey = match[2];
        const entityValue = match[3];

        if (entityTitle === "Domain") continue;

        if (entityKey.length <= 0) {
            entityKey = "fn";
        }

        if (!parsedEntities[entityTitle]) {
            parsedEntities[entityTitle] = {};
        }

        parsedEntities[entityTitle][entityKey] = entityValue;
    }

    const vcardArrayFormatEntities: Entity[] = [];
    for (const i in parsedEntities) {
        const vcardArray = [];

        for (const k in parsedEntities[i]) {
            vcardArray.push([k, {}, "text", parsedEntities[i][k]]);
        }

        vcardArrayFormatEntities.push({
            handle: "",
            roles: [i],
            vcardArray: ["vcard", vcardArray],
        });
    }

    return {
        success: true,
        response: "",
        whoisServer: server,
        data: {
            raw: data,
            rdaptype: RDAPTypes.DOMAIN,
            nameservers: parsedNameservers,
            events: parsedEvents,
            entities: vcardArrayFormatEntities,
        },
    };
}
