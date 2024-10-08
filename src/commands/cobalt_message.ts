"use strict";

import { Command, Command_Type } from "../types";
import { Execute } from "./cobalt";

const CommandObject: Command = {
    name: "cobalt",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    type: Command_Type.MESSAGE,
};

export { Execute, CommandObject };
