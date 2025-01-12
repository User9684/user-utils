import { isWhitelisted } from "../commands";
import {
    CallbackType,
    ComponentObject,
    ComponentType,
    Ctx,
    Env,
    Interaction,
    InteractionResponse,
    TextInputType,
} from "../types";

const ComponentObject: ComponentObject = {
    custom_id: /ai_start_reply_([a-z0-9]+)/i,
};

async function Execute(
    env: Env,
    interaction: Interaction,
    ctx: Ctx
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

    const chat_id = [
        ...interaction.data.custom_id.match(ComponentObject.custom_id),
    ][1];

    return {
        type: CallbackType.MODAL,
        data: {
            custom_id: `ai_reply_${chat_id}`,
            title: "Message Reply",
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            custom_id: "unused",
                            style: TextInputType.Paragraph,
                            label: "Reply",
                            min_length: 1,
                            required: true,
                        },
                    ],
                },
            ],
        },
    };
}

export const instant_execution = true;
export { ComponentObject, Execute };
