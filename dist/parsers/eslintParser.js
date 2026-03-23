const fileHeaderPattern = /^(?<file>(?:[A-Za-z]:)?[^:\n][^\n]*\.[a-zA-Z0-9]+)$/;
const issuePattern = /^\s*(?<line>\d+):(?<column>\d+)\s+(?<category>error|warning)\s+(?<message>.+?)(?:\s{2,}(?<rule>[^\s]+))?\s*$/;
export function parseEslint(input) {
    const issues = [];
    let currentFile;
    for (const line of input.split("\n")) {
        const fileMatch = line.match(fileHeaderPattern);
        if (fileMatch?.groups?.file) {
            const file = fileMatch.groups.file;
            if (!file) {
                continue;
            }
            currentFile = file.trim();
            continue;
        }
        const issueMatch = line.match(issuePattern);
        if (!issueMatch?.groups) {
            continue;
        }
        const { category, line: lineText, column: columnText, message, rule } = issueMatch.groups;
        if (!category || !lineText || !columnText || !message) {
            continue;
        }
        const issue = {
            tool: "eslint",
            category,
            line: Number(lineText),
            column: Number(columnText),
            message: message.trim()
        };
        if (rule) {
            issue.ruleOrCode = rule;
        }
        if (currentFile) {
            issue.file = currentFile;
        }
        issues.push(issue);
    }
    return issues;
}
