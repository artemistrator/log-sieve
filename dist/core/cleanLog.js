const ANSI_PATTERN = 
// eslint-disable-next-line no-control-regex
/\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
export function cleanLog(input) {
    return input
        .replace(ANSI_PATTERN, "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.replace(/\s+$/g, ""))
        .filter((line, index, lines) => {
        if (line.trim() !== "") {
            return true;
        }
        return lines[index - 1]?.trim() !== "";
    })
        .join("\n")
        .trim();
}
