"use strict";
import { BotCommand, BotComponent } from "./types";

import * as refresh from "./commands/refreshcommands";
import * as webhook from "./commands/webhook";
import * as say from "./commands/say";
import * as whois from "./commands/whois";
import * as report from "./commands/report";
import * as cobalt from "./commands/cobalt";
import * as whois_select_menu from "./components/whois_select_menu";
import * as whois_next from "./components/whois_next";

export const commands: { [id: string]: BotCommand } = {
    refresh,
    webhook,
    say,
    whois,
    report,
    cobalt,
};

export const components: { [id: string]: BotComponent } = {
    whois_select_menu,
    whois_next,
    whois_previous: whois_next,
};
