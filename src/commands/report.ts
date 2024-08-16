"use strict";

import {
    CallbackType,
    Command,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";

const CommandObject: Command = {
    name: "report",
    description: "Report a domain to fishfish",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.STRING,
            name: "domain",
            description: "Domain/URL to report.",
            required: true,
        },
        {
            type: OptionType.STRING,
            name: "reason",
            description: "Reason of report",
            required: true,
        },
    ],
};

const reportURL = "https://yuri.bots.lostluma.dev/phish/report";
type reportApiResponse = {
    accepted: boolean;
    reason?: string;
};
const submitURL = "https://phish.observer/api/submit";
type submitApiResponse = {
    id: string;
};

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const userID = interaction?.member?.user?.id || interaction?.user?.id || "";

    const domain = interaction?.data?.options?.[0];
    const reportReason =
        interaction?.data?.options?.[1]?.value.toString() || "";

    if (reportReason.length < 5) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Reason is too short!",
                flags: 64,
            },
        };
    }

    const submitRes = await fetch(submitURL, {
        body: JSON.stringify({
            url: domain.value,
        }),
        headers: {
            Authorization: `Bearer ${env.PHISHOBSERVER_AUTH}`,
        },
        method: "POST",
    });
    const submitBody: submitApiResponse = await submitRes.json();

    let reason = `###
    **Report submitted via 9684 bot**
    
    - Reporter ID: \`${userID}\`
    - Report Reason: ${reportReason.replaceAll("\n", "")}`;

    if (submitBody.id) {
        reason += `\n- Webpage Scan: https://phish.observer/scan/${submitBody.id}`;
    }

    reason += "\n";

    const res = await fetch(reportURL, {
        body: JSON.stringify({
            reason: reason,
            url: domain.value,
        }),
        headers: {
            Authorization: env.FISHFISH_AUTH,
        },
        method: "POST",
    });

    const responseBody: reportApiResponse = await res.json();

    if (responseBody.accepted) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "Successfully reported domain!",
                flags: 64,
            },
        };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: `Could not report domain.\n\`${responseBody.reason}\``,
            flags: 64,
        },
    };
}

export { CommandObject, Execute };
