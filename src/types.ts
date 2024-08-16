"use strict";

export type Env = {
    PUBLIC_KEY: string;
    TOKEN: string;
    BOT_OWNER: string;
    FISHFISH_AUTH: string;
    PHISHOBSERVER_AUTH: string;
    RDAPCache: KVNamespace;
    MessageQueries: KVNamespace;
};

export type Ctx = EventContext<Env, any, any>;

export enum InteractionType {
    PING = 1,
    APPLICATION_COMMAND,
    MESSAGE_COMPONENT,
    APPLICATION_COMMAND_AUTOCOMPLETE,
    MODAL_SUBMIT,
}

export enum CallbackType {
    IGNORE = 0,
    PONG,
    CHANNEL_MESSAGE_WITH_SOURCE = 4,
    DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    DEFERRED_UPDATE_MESSAGE,
    UPDATE_MESSAGE,
    APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    MODAL,
    PREMIUM_REQUIRED,
}

export enum Command_Type {
    CHAT_INPUT = 1,
    USER,
    MESSAGE,
}

export enum OptionType {
    SUB_COMMAND = 1,
    SUB_COMMAND_GROUP,
    STRING,
    INTEGER,
    BOOLEAN,
    USER,
    CHANNEL,
    ROLE,
    MENTIONABLE,
    NUMBER,
    ATTACHMENT,
}

export type CommandOptionChoice = {
    name: string;
    value: string | number;
};

export type CommandOption = {
    type: OptionType;
    name: string;
    description: string;
    required?: boolean;
    choices?: CommandOptionChoice[];
    options?: CommandOption[];
};

export type Command = {
    id?: string;
    application_id?: string;
    guild_id?: string;
    description: string;
    name: string;
    options?: CommandOption[];
    integration_types?: Array<"0" | "1">;
    contexts?: Array<"0" | "1" | "2">;
};

export type AttatchmentPartial = {
    blob: Blob;
    fileName: string;
};

export type EmojiPartial = {
    id: string;
    name: string;
    animated?: boolean;
};

export type EmbedType =
    | "rich"
    | "image"
    | "video"
    | "gifv"
    | "article"
    | "link";

export type EmbedFooter = {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
};

export type EmbedMedia = {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
};

export type EmbedProvider = {
    name?: string;
    url?: string;
};

export type EmbedAuthor = {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
};

export type EmbedField = {
    name: string;
    value: string;
    inline?: boolean;
};

export type Embed = {
    title?: string;
    type?: EmbedType;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number;
    footer?: EmbedFooter;
    image?: EmbedMedia;
    thumbnail?: EmbedMedia;
    video?: EmbedMedia;
    fields?: EmbedField[];
};

export type RowComponent = {
    type: ComponentType.ActionRow;
    components: Component[];
};

export enum ComponentType {
    ActionRow = 1,
    Button,
    StringSelect,
    TextInput,
    UserSelect,
    RoleSelect,
    MentionableSelect,
    ChannelSelect,
}

export enum ButtonCompontentType {
    Primary = 1,
    Secondary,
    Success,
    Danger,
    Link,
    Premium,
}

export type ButtonCompontent = {
    type: ComponentType.Button;
    style: ButtonCompontentType;
    label?: string;
    emoji?: EmojiPartial;
    custom_id?: string;
    sku_id?: string;
    url?: string;
    disabled?: boolean;
};

export type SelectMenuComponentOption = {
    label: string;
    value: string;
    description?: string;
    emoji?: EmojiPartial;
    default?: boolean;
};

export type SelectMenuComponent = {
    type: ComponentType;
    custom_id: string;
    options?: SelectMenuComponentOption[];
    channel_types?: number[];
    placeholder?: string;
    min_values?: number;
    max_values?: number;
    disabled?: boolean;
};

export type Component = RowComponent | ButtonCompontent | SelectMenuComponent;

export type InteractionCallback = {
    tts?: boolean;
    content?: string;
    embeds?: Embed[];
    allowed_mentions?: {};
    flags?: number;
    components?: RowComponent[];
    attachments?: AttatchmentPartial[];
    poll?: {};
};

export type InteractionData = {
    id: string;
    name: string;
    type: InteractionType;
    resolved?: {};
    options?: InteractionOption[];
    guild_id?: string;
    target_id?: string;
    custom_id?: string;
    component_type?: ComponentType;
    values?: any[];
};

export type InteractionOption = {
    name: string;
    type: number;
    value: string | number | boolean;
    options?: InteractionOption[];
    focused: boolean;
};

export type InteractionMetadata = {
    id: string;
};

export type Message = {
    content?: string;
    id?: string;
    channel_id?: string;
    embeds?: Embed[];
    components?: Component[];
    attachments?: AttatchmentPartial[];
    interaction_metadata?: InteractionMetadata;
};

export type User = {
    id: string;
    username: string;
    discriminator: string;
    global_name?: string;
    avatar?: string;
    bot?: boolean;
    system?: boolean;
    mfa_enabled?: string;
    banner?: string;
    locale?: string;
    verified?: boolean;
    flags?: number;
    premium_type?: number;
    public_flags?: number;
    avatar_decoration?: string;
};

export type Member = {
    user?: User;
    nick?: string;
    avatar?: string;
};

export type Interaction = {
    id: string;
    application_id: string;
    type: InteractionType;
    data: InteractionData;
    guild_id?: string;
    channel: {};
    channel_id: string;
    member: Member;
    user: User;
    token: string;
    version: number;
    message?: Message;
    app_permissions: string;
    locale?: string;
    guild_locale?: string;
    entitlements: [];
    authorizing_integration_owners: {};
    context?: {};
};

export type InteractionResponse = {
    type: CallbackType;
    data?: InteractionCallback;
};

export type ComponentObject = {
    custom_id: string;
};

export type BotComponent = {
    ComponentObject: ComponentObject;
    Execute: (
        env: Env,
        interaction: Interaction,
        ctx: Ctx
    ) => Promise<InteractionResponse>;
};

export type BotCommand = {
    CommandObject: Command;
    Execute: (
        env: Env,
        interaction: Interaction,
        ctx: Ctx
    ) => Promise<InteractionResponse>;
};
