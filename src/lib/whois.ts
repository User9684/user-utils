import { connect } from "cloudflare:sockets";

const ianaWhois = "whois.iana.org";
const referRegex = /refer:\s+(.+)/;

export type WhoisData = {
    success: boolean;
    response: string;
};

async function whoisRequest(query: string, domain: string): Promise<string> {
    const whoisQuery = new TextEncoder().encode(query);

    const socket = connect(domain + ":43");
    const writer = socket.writable.getWriter();
    await writer.write(whoisQuery);

    const res = new Response(socket.readable);
    const text = await res.text();
    socket.close();

    return text;
}

export async function Whois(query: string): Promise<WhoisData> {
    const text = await whoisRequest(query + "\r\n", ianaWhois);

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

    const refer = referRegex.exec(text);

    if (!refer || refer.length <= 1) {
        return {
            success: true,
            response: text,
        };
    }

    const text2 = await whoisRequest(query, refer[1]);

    return {
        success: true,
        response: text2,
    };
}

export async function ParseWhois(data: string) {}
