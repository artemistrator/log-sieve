import { stdout, stderr } from "node:process";
import { cleanLog } from "./cleanLog.js";
import { computeExitCode } from "./computeExitCode.js";
import { getHelpText, parseArgs } from "./parseArgs.js";
import { readInput } from "./readInput.js";
import { renderOutput } from "./renderOutput.js";
import { summarizeLog } from "./summarizeLog.js";
import { writeOutput } from "./writeOutput.js";
const defaultIo = {
    writeStdout: (text) => {
        stdout.write(text);
    },
    writeStderr: (text) => {
        stderr.write(text);
    }
};
export async function executeCli(args, io = defaultIo) {
    let options;
    try {
        options = parseArgs(args);
    }
    catch (error) {
        io.writeStderr(`${getErrorMessage(error)}\n`);
        return 2;
    }
    if (options.help) {
        io.writeStdout(`${getHelpText()}\n`);
        return 0;
    }
    let input;
    try {
        input = await readInput(options);
    }
    catch (error) {
        io.writeStderr(`${getErrorMessage(error)}\n`);
        return 2;
    }
    if (!input.source) {
        io.writeStdout(`${getHelpText()}\n`);
        return 2;
    }
    const cleanedLog = cleanLog(input.rawInput);
    let summary;
    try {
        summary = summarizeLog(input.rawInput);
    }
    catch (error) {
        io.writeStderr(`${getErrorMessage(error)}\n`);
        printRawOnError(io, cleanedLog, options.printRawOnError);
        return 2;
    }
    const output = renderOutput(summary, options);
    if (options.output) {
        try {
            await writeOutput(options.output, output);
        }
        catch (error) {
            io.writeStderr(`${getErrorMessage(error)}\n`);
            return 2;
        }
    }
    if (!options.quiet) {
        io.writeStdout(`${output}\n`);
    }
    if (shouldPrintRawForNoUsefulOutput(options, input.exitCode, input.source, summary.uniqueIssues, cleanedLog)) {
        printRawOnError(io, cleanedLog, true);
    }
    const baseExitCode = input.source === "run" ? input.exitCode : 0;
    return computeExitCode({
        baseExitCode,
        failOn: options.failOn,
        summary
    });
}
function shouldPrintRawForNoUsefulOutput(options, baseExitCode, source, uniqueIssues, cleanedLog) {
    return (options.printRawOnError &&
        source === "run" &&
        baseExitCode !== 0 &&
        uniqueIssues === 0 &&
        cleanedLog.trim() !== "");
}
function printRawOnError(io, cleanedLog, enabled) {
    if (!enabled || cleanedLog.trim() === "") {
        return;
    }
    io.writeStderr(`Raw cleaned log:\n${cleanedLog}\n`);
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
