import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { runCommand } from "./runCommand.js";
export async function readInput(options) {
    if (options.file) {
        return {
            rawInput: await readFile(options.file, "utf8"),
            exitCode: 0,
            source: "file"
        };
    }
    if (options.run) {
        return runCommand(options.run);
    }
    if (stdin.isTTY) {
        return {
            rawInput: "",
            exitCode: 0
        };
    }
    return {
        rawInput: await readStdin(),
        exitCode: 0,
        source: "stdin"
    };
}
async function readStdin() {
    let result = "";
    for await (const chunk of stdin) {
        result += String(chunk);
    }
    return result;
}
