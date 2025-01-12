import { ExecuteChat } from "../commands/ai";
import {
    CallbackType,
    ComponentObject,
    Ctx,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
    RowComponent,
    TextInputComponent,
} from "../types";

const ModalObject: ComponentObject = {
    custom_id: /ai_reply_([a-z0-9]+)/i,
};

async function Execute(
    env: Env,
    interaction: Interaction,
    ctx: Ctx
): Promise<InteractionResponse> {
    const value = (<TextInputComponent>(
        (<RowComponent>interaction.data.components[0]).components[0]
    )).value;

    console.log(interaction.data.components);

    return await ExecuteChat(
        env,
        interaction,
        {
            name: "",
            value: "",
            type: OptionType.SUB_COMMAND,
            options: [
                {
                    name: "prompt",
                    value: value,
                    type: OptionType.STRING,
                },
            ],
        },
        false
    );
}
export { ModalObject, Execute };
