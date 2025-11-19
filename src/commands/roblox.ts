import {
    Attachment,
    ButtonCompontentType,
    CallbackType,
    Command,
    CommandOptionChoice,
    ComponentType,
    Env,
    Interaction,
    InteractionOption,
    InteractionResponse,
    OptionType,
} from "../types";

const DEVEX_RATE = 0.0038;

const CommandObject: Command = {
    name: "roblox",
    description: "Roblox Utility commands",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.SUB_COMMAND,
            name: "devex",
            description:
                "Converts robux to USD or USD to robux based on the devex rate",
            options: [
                {
                    type: OptionType.STRING,
                    name: "robux",
                    description: "Robux to USD",
                    required: false,
                },
                {
                    type: OptionType.STRING,
                    name: "usd",
                    description: "USD to Robux",
                    required: false,
                },
            ],
        },

        {
            type: OptionType.SUB_COMMAND,
            name: "tax",
            description: "Gets expected robux rates minus a tax rate",
            options: [
                {
                    type: OptionType.NUMBER,
                    name: "tax",
                    description: "Tax rate applied, defaults to 0.30",
                    required: false,
                },
                {
                    type: OptionType.STRING,
                    name: "input",
                    description: "How much robux you'd get from this sale",
                    required: false,
                },
                {
                    type: OptionType.STRING,
                    name: "output",
                    description:
                        "The price you need to get this value from a sale",
                    required: false,
                },
            ],
        },
    ],
};

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const subcommandData = interaction?.data?.options?.[0];
    switch (subcommandData?.name) {
        case "devex":
            return await ExecuteDevex(env, interaction, subcommandData);
        case "tax":
            return await ExecuteTax(env, interaction, subcommandData);
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content:
                "https://cdn.discordapp.com/attachments/1237548897476280471/1440555619835973692/9czMS0l.gif",
        },
    };
}

async function ExecuteTax(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const taxOption = options.find((v) => v.name === "tax");
    const inputOption = options.find((v) => v.name === "input");
    const outputOption = options.find((v) => v.name === "output");

    const tax = (taxOption && (taxOption.value as number)) || 0.3;

    const selectedOption = inputOption || outputOption;
    if (!selectedOption) {
        if (!selectedOption) {
            return {
                type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "You must select an option!",
                    flags: 64,
                },
            };
        }
    }

    const numVal = Number(selectedOption.value);

    if (Number.isNaN(numVal)) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "hey, buddy. this needs to be a number.",
                flags: 64,
            },
        };
    }

    if (selectedOption.name == "input") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `${numVal} Robux sale nets you ${
                    numVal * (1 - tax)
                } Robux`,
            },
        };
    } else {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `You need to sell at ${
                    numVal * (1 + tax)
                } Robux to net ${numVal} Robux`,
            },
        };
    }
}

async function ExecuteDevex(
    env: Env,
    interaction: Interaction,
    subcommandData: InteractionOption
): Promise<InteractionResponse> {
    const options = subcommandData.options || [];
    const selectedOption = options[0];

    if (!selectedOption) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "You must select an option!",
                flags: 64,
            },
        };
    }

    const numVal = Number(selectedOption.value);

    if (Number.isNaN(numVal)) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "hey, buddy. this needs to be a number.",
                flags: 64,
            },
        };
    }

    if (selectedOption.name == "usd") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `${numVal} USD is equal to ${
                    numVal / DEVEX_RATE
                } Robux`,
            },
        };
    } else if (selectedOption.name == "robux") {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `${numVal} Robux is equal to ${
                    numVal * DEVEX_RATE
                } USD`,
            },
        };
    }

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "hey buddy what the fuck",
        },
    };
}

export { CommandObject, Execute };
