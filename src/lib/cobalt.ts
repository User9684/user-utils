
import { Env } from "../types";

export type CobaltPicker = {
    type?: "video" | "photo" | "gif";
    url: string;
    thumb?: string;
};

export type CobaltResponse = {
    status:
        | "error"
        | "redirect"
        | "stream"
        | "tunnel"
        | "success"
        | "rate-limit"
        | "picker";
    text?: string;
    url?: string;
    pickerType?: "various" | "images";
    picker?: CobaltPicker[];
    audio?: string;
};

const isURL = (uri: string) => {
    try {
        return Boolean(new URL(uri));
    } catch (_) {
        return false;
    }
};

const unmarshalResponse = async (
    response: Response
): Promise<CobaltResponse | false> => {
    try {
        return await response.json();
    } catch (err) {
        console.log(err);
        return false;
    }
};

async function parseInput(input: string): Promise<string | false> {
    if (!isURL(input)) {
        return false;
    }

    const url = new URL(input);

    switch (url.hostname) {
        case "www.instagram.com":
        case "instagram.com":
            input = input.replace("/reels/", "/reel/");
            break;
    }

    return input;
}

export async function CobaltHeaders(env: Env, contentType: string) {
    const requestHeaders = {
        "User-Agent": "9684 utilities bot",
        Accept: "application/json",
        "Content-Type": contentType,
    };

    if (env.COBALT_ACCESS_HEADER && env.COBALT_ACCESS_HEADER.length > 0) {
        requestHeaders["authorization"] = env.COBALT_ACCESS_HEADER;
    }

    console.log(requestHeaders);

    return requestHeaders;
}

export async function GetCobaltData(
    env: Env,
    url: string
): Promise<CobaltResponse | string> {
    const parsedURL = await parseInput(url);
    if (!parsedURL) {
        console.log("Cobalt: URI invalid");
        return "Invalid URI!";
    }

    const apiURI = `${env.COBALT_URL}`;

    const response = await fetch(apiURI, {
        headers: await CobaltHeaders(env, "application/json"),
        method: "POST",
        body: JSON.stringify({
            url: parsedURL,
        }),
    });

    const body = await unmarshalResponse(response);

    if (!body) {
        console.log(`Invalid response!`);
        return "Invalid response from cobalt!";
    }

    if (body.status === "rate-limit") {
        console.log(`Cobalt: api ratelimited`);
        return "Ratelimited!";
    }
    if (body.status === "error") {
        console.log(`Cobalt: api errored`);
        return "Something errored while fetching!";
    }
    if (
        !(
            body.status === "picker" ||
            body.status === "redirect" ||
            body.status === "stream" ||
            body.status === "tunnel"
        )
    ) {
        console.log(
            `Cobalt: ${apiURI} malformed status ${JSON.stringify(body)}`
        );
        return `Malformed status \`${body.status}\``;
    }

    return body;
}
