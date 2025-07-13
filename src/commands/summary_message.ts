import { isWhitelisted } from "../commands";
import {
    CallbackType,
    Command,
    Command_Type,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";
import { ExecuteSummary } from "./ai";

const CommandObject: Command = {
    name: "summary",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    type: Command_Type.MESSAGE,
};

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    const user = interaction?.member?.user || interaction?.user;
    const userID = (user && user?.id) || "";

    if (!(await isWhitelisted(env, userID, "ai"))) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "You are not whitelisted on this command!",
                flags: 64,
            },
        };
    }

    let message =
        interaction.data.resolved.messages[interaction.data.target_id];

    if (
        message.content.length <= 0 &&
        message.message_snapshots &&
        message.message_snapshots.length > 0
    ) {
        message = message.message_snapshots[0].message;
    }

    if (!message || message.content.length <= 0) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No message found!",
            },
        };
    }

    return await ExecuteSummary(env, interaction, {
        name: "",
        value: "",
        type: OptionType.SUB_COMMAND,
        options: [
            {
                name: "text",
                value: message.content,
                type: OptionType.STRING,
            },
        ],
    });
}

export { Execute, CommandObject };
