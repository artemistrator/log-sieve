import { normalizeComparisonPath, normalizeIssueText } from "./logNormalization.js";
export function dedupeIssues(issues) {
    const seenExact = new Set();
    const seenLoose = new Set();
    const unique = [];
    for (const issue of issues) {
        const exactKey = [
            normalizeIssueText(issue.tool),
            normalizeIssueText(issue.category),
            normalizePath(issue.file),
            issue.line ?? "",
            issue.column ?? "",
            normalizeIssueText(issue.ruleOrCode ?? ""),
            normalizeIssueText(issue.message),
            normalizeIssueText(issue.rawSnippet ?? "")
        ].join("|");
        const looseKey = [
            normalizeIssueText(issue.tool),
            normalizeIssueText(issue.category),
            normalizePath(issue.file),
            normalizeIssueText(issue.ruleOrCode ?? ""),
            normalizeIssueText(issue.message)
        ].join("|");
        if (seenExact.has(exactKey) || (usesLooseDedupe(issue) && seenLoose.has(looseKey))) {
            continue;
        }
        seenExact.add(exactKey);
        seenLoose.add(looseKey);
        unique.push(issue);
    }
    return unique;
}
function usesLooseDedupe(issue) {
    return issue.tool === "generic" || issue.tool === "test" || issue.line === undefined;
}
function normalizePath(value) {
    return value ? normalizeComparisonPath(value) : "";
}
