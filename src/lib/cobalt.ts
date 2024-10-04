"use strict";

type Instance = {
    api: string;
    api_online: boolean;
    branch: string;
    commit: string;
    cors: number;
    frontEnd: string;
    name: string;
    protocol: string;
    score: number;
    services: Map<string, boolean>;
    startTime: number;
    trust: string;
    version: string;
};

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
        | "success"
        | "rate-limit"
        | "picker";
    text?: string;
    url?: string;
    pickerType?: "various" | "images";
    picker?: CobaltPicker[];
    audio?: string;
    serviceUsed?: string;
};

type CobaltPair = {
    api: string;
    frontend?: string;
}

const instancesList = "https://instances.hyper.lol/instances.json"; // Maintained by hyperdefined, ty :3

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
    } catch (_) {
        return false;
    }
};

async function getPossibleAPIs(): Promise<CobaltPair[]> {
    const response = await fetch(instancesList, {
        headers: {
            "User-Agent": "9684 utilities bot",
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "GET",
    });

    const acceptedAPIs: CobaltPair[] = [];

    const body: Instance[] = await response.json();

    for (const i in body) {
        const instance = body[i];
        const apiURI = "https://" + instance.api;
        if (!instance.api_online || !isURL(apiURI)) {
            continue;
        }

        if (instance.score < 85) {
            continue;
        }

        if (instance.trust !== "safe") {
            continue;
        }

        const pair:CobaltPair = {
            api: apiURI,
        }

        if (instance.frontEnd !== "None") {
            pair.frontend = instance.frontEnd
        }

        acceptedAPIs.push(pair);
    }

    return acceptedAPIs;
}

async function parseInput(input: string): Promise<string | false> {
    if (!isURL(input)) {
        return false;
    }

    const url = new URL(input);

    switch (url.hostname) {
        case "www.instagram.com":
        case "instagram.com" || "www.instagram.com":
            input = input.replace("/reels/", "/reel/");
    }

    return input;
}

export async function GetCobaltData(
    url: string
): Promise<CobaltResponse | false> {
    const parsedURL = await parseInput(url);
    if (!parsedURL) {
        return false;
    }

    const instances = await getPossibleAPIs();
    console.log(`Cobalt: Found ${instances.length} possible APIs`);
    for (const i in instances) {
        const apiURL = instances[i];

        const response = await fetch(apiURL.api + "/api/json", {
            headers: {
                "User-Agent": "9684 utilities bot",
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                url: parsedURL,
            }),
        });

        const body = await unmarshalResponse(response);

        if (!body) {
            continue;
        }

        if (body.status === "rate-limit") {
            console.log(`Cobalt: ${apiURL} ratelimited`);
            continue;
        }
        if (body.status === "error") {
            console.log(`Cobalt: ${apiURL} errored`);
            continue;
        }
        if (
            !(
                body.status === "picker" ||
                body.status === "redirect" ||
                body.status === "stream"
            )
        ) {
            console.log(`Cobalt: ${apiURL} malformed status ${JSON.stringify(body)}`);
            continue;
        }

        console.log(`Cobalt: ${apiURL} passed all checks`);
        body.serviceUsed = apiURL.frontend || apiURL.api;

        return body;
    }

    return false;
}
