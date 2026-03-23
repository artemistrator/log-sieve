export function formatText(view, forLlm) {
    const lines = [
        `Detected: ${formatDetectedTool(view)}`,
        `Raw issues: ${view.totalIssues}`,
        `Unique issues: ${view.uniqueIssues}`
    ];
    if (view.rootCauseHint) {
        lines.push(`Root cause hint: ${view.rootCauseHint}`);
    }
    if (view.issues.length === 0) {
        lines.push("", "No structured issues found.");
    }
    else {
        lines.push("", "Top issues:");
        view.issues.forEach((issue, index) => {
            lines.push(`${index + 1}. ${formatIssue(issue)}`);
        });
        lines.push("", `${view.groupedTitle}:`);
        for (const item of view.groupedItems) {
            lines.push(`- ${item.label} (${item.count})`);
        }
    }
    if (forLlm) {
        lines.push("");
        if (view.likelyFirstFixTarget) {
            lines.push(`Likely first fix target: ${view.likelyFirstFixTarget}`);
        }
        lines.push("Recommended fix order:");
        view.recommendedFixOrder.forEach((step, index) => {
            lines.push(`${index + 1}. ${step}`);
        });
    }
    lines.push("", "Next step:", view.nextStep);
    if (view.truncated) {
        lines.push("", `Truncated: omitted ${view.omittedIssues} lower-priority issue(s).`);
    }
    return lines.join("\n");
}
function formatIssue(issue) {
    const location = [issue.file, formatPosition(issue.line, issue.column)].filter(Boolean).join(":");
    const parts = [];
    if (location) {
        parts.push(location);
    }
    if (issue.ruleOrCode) {
        parts.push(`[${issue.ruleOrCode}]`);
    }
    if (!location && !issue.ruleOrCode) {
        parts.push(`[${issue.tool}:${issue.category}]`);
    }
    parts.push(issue.message);
    return parts.join(" ");
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
