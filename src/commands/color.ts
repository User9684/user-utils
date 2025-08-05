import { Buffer } from 'node:buffer';

import {
    CallbackType,
    Command,
    Env,
    Interaction,
    InteractionResponse,
    OptionType,
} from "../types";

const CommandObject: Command = {
    name: "color",
    description: "Reponds with a 512x512 image of color (also, hi if youre reading this)",
    integration_types: ["0", "1"],
    contexts: ["0", "1", "2"],
    options: [
        {
            type: OptionType.SUB_COMMAND,
            name: "hex",
            description: "Responds w/ hex value",
            options: [
                {
                    type: OptionType.STRING,
                    name: "value",
                    description: "Hex Value",
                    required: true,
                },
            ],
        },
        {
            type: OptionType.SUB_COMMAND,
            name: "rgb",
            description: "Responds w/ RGB value",
            options: [
                {
                    type: OptionType.NUMBER,
                    name: "r",
                    description: "Red Value",
                    required: true,
                },
                {
                    type: OptionType.NUMBER,
                    name: "g",
                    description: "Green Value",
                    required: true,
                },
                {
                    type: OptionType.NUMBER,
                    name: "b",
                    description: "Blue Value",
                    required: true,
                },
            ],
        },
    ],
};

// stolen code from stack overflow. kiss me about it
function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
}

// kiss me about it
function ColorImage(r, g, b, width, height) {
    const a = 255;

    function writeUInt32BE(buf, offset, val) {
        buf[offset] = (val >>> 24) & 0xff;
        buf[offset + 1] = (val >>> 16) & 0xff;
        buf[offset + 2] = (val >>> 8) & 0xff;
        buf[offset + 3] = val & 0xff;
    }

    function adler32(buf) {
        let a = 1,
            b = 0;
        for (let i = 0; i < buf.length; i++) {
            a = (a + buf[i]) % 65521;
            b = (b + a) % 65521;
        }
        return ((b << 16) | a) >>> 0;
    }

    const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++)
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            table[i] = c >>> 0;
        }
        return table;
    })();

    function crc32(buf: Uint8Array): number {
        let crc = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
        }
        return ~crc >>> 0;
    }

    function makeChunk(typeStr, data) {
        const type = Buffer.from(typeStr);
        const chunk = Buffer.alloc(8 + data.length + 4);
        writeUInt32BE(chunk, 0, data.length);
        type.copy(chunk, 4);
        data.copy(chunk, 8);
        writeUInt32BE(
            chunk,
            8 + data.length,
            crc32(Buffer.concat([type, data]))
        );
        return chunk;
    }

    const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];

    const ihdr = Buffer.alloc(13);
    writeUInt32BE(ihdr, 0, width);
    writeUInt32BE(ihdr, 4, height);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    parts.push(makeChunk("IHDR", ihdr));

    const raw = Buffer.alloc(height * (1 + width * 4));
    let p = 0;
    for (let y = 0; y < height; y++) {
        raw[p++] = 0;
        for (let x = 0; x < width; x++) {
            raw[p++] = r;
            raw[p++] = g;
            raw[p++] = b;
            raw[p++] = a;
        }
    }

    const blocks = [];
    const max = 65535;
    for (let i = 0; i < raw.length; i += max) {
        const len = Math.min(max, raw.length - i);
        const block = Buffer.alloc(5 + len);
        block[0] = i + len >= raw.length ? 1 : 0;
        block[1] = len & 0xff;
        block[2] = (len >> 8) & 0xff;
        const nlen = ~len & 0xffff;
        block[3] = nlen & 0xff;
        block[4] = (nlen >> 8) & 0xff;
        raw.copy(block, 5, i, i + len);
        blocks.push(block);
    }

    const deflateData = Buffer.concat(blocks);
    const zlibHeader = Buffer.from([0x78, 0x01]);
    const adler = Buffer.alloc(4);
    writeUInt32BE(adler, 0, adler32(raw));
    const zlibData = Buffer.concat([zlibHeader, deflateData, adler]);

    parts.push(makeChunk("IDAT", zlibData));

    parts.push(makeChunk("IEND", Buffer.alloc(0)));

    return Buffer.concat(parts);
}

async function Execute(
    env: Env,
    interaction: Interaction
): Promise<InteractionResponse> {
    if (!interaction?.data?.options?.[0]) {
        return {
            type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "No value given",
                flags: 64,
            },
        };
    }

    const subcommandData = interaction?.data?.options?.[0];

    let color;
    switch (subcommandData.name) {
        case "hex":
            color = hexToRgb(subcommandData.options[0].value);
            break;
        case "rgb":
            color = {
                r: subcommandData.options.find((x) => x.name == "r")
                    .value as number,
                g: subcommandData.options.find((x) => x.name == "g")
                    .value as number,
                b: subcommandData.options.find((x) => x.name == "b")
                    .value as number,
            };
    }

    const img = ColorImage(color.r, color.g, color.b, 512, 512)

    const blob = new Blob([img], { type: "application/octet-stream" });

    return {
        type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Done! :3",
            attachments: [
                {
                    blob: blob,
                    fileName: "media.png",
                },
            ],
        },
    };
}

export { CommandObject, Execute };
