export function formatCiText(view) {
    const lines = [
        `Detected: ${formatDetectedTool(view)}`,
        `Raw issues: ${view.totalIssues}`,
        `Unique issues: ${view.uniqueIssues}`
    ];
    if (view.issues.length > 0) {
        lines.push("Top issues:");
        view.issues.slice(0, 3).forEach((issue, index) => {
            lines.push(`${index + 1}. ${formatIssue(issue)}`);
        });
    }
    else {
        lines.push("Top issues: none");
    }
    lines.push(`Next step: ${view.nextStep}`);
    return lines.join("\n");
}
function formatIssue(issue) {
    const location = [issue.file, formatPosition(issue.line, issue.column)].filter(Boolean).join(":");
    const code = issue.ruleOrCode ? ` [${issue.ruleOrCode}]` : "";
    const prefix = location || `[${issue.tool}:${issue.category}]`;
    return `${prefix}${code} ${issue.message}`;
}
function formatPosition(line, column) {
    if (line === undefined) {
        return undefined;
    }
    return column === undefined ? `${line}` : `${line}:${column}`;
}
function formatDetectedTool(view) {
    return view.uniqueIssues === 0 && view.detectedTool === "generic"
        ? "no structured issues"
        : view.detectedTool;
}
