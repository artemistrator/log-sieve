import { cwd } from "node:process";
import { isAbsolute, relative } from "node:path";
const defaultTextIssueCount = 5;
const defaultLlmIssueCount = 3;
const defaultCiIssueCount = 3;
export function createReportView(summary, options) {
    const llmIssues = options.forLlm ? selectLlmIssues(summary.issues) : summary.issues;
    const displayIssues = toDisplayIssues(compactIssuesForDisplay(llmIssues));
    const issueLimit = options.maxIssues ??
        (options.ci ? defaultCiIssueCount : options.forLlm ? defaultLlmIssueCount : defaultTextIssueCount);
    const issues = displayIssues.slice(0, issueLimit);
    const omittedIssues = Math.max(displayIssues.length - issues.length, 0);
    const grouped = groupIssues(issues);
    const view = {
        detectedTool: summary.detectedTool,
        totalIssues: summary.totalIssues,
        uniqueIssues: summary.uniqueIssues,
        issues,
        groupedTitle: grouped.title,
        groupedItems: grouped.items.slice(0, 5),
        nextStep: summary.nextStep,
        recommendedFixOrder: getRecommendedFixOrder(issues),
        truncated: omittedIssues > 0,
        omittedIssues
    };
    if (summary.rootCauseHint) {
        view.rootCauseHint = summary.rootCauseHint;
    }
    const likelyFirstFixTarget = getLikelyFirstFixTarget(issues[0]);
    if (likelyFirstFixTarget) {
        view.likelyFirstFixTarget = likelyFirstFixTarget;
    }
    return view;
}
function selectLlmIssues(issues) {
    const actionable = issues.filter((issue) => issue.priority === "high" || issue.priority === "medium");
    return actionable.length > 0 ? actionable : issues;
}
function compactIssuesForDisplay(issues) {
    return issues.filter((issue) => {
        if (issue.tool !== "test" || issue.category !== "failure" || issue.line !== undefined || !issue.file) {
            return true;
        }
        return !issues.some((other) => other !== issue &&
            other.tool === "test" &&
            other.file === issue.file &&
            other.line !== undefined);
    });
}
function toDisplayIssues(issues) {
    return issues.map((issue) => {
        if (!issue.file) {
            return issue;
        }
        const displayFile = toDisplayPath(issue.file);
        if (displayFile === issue.file) {
            return issue;
        }
        return {
            ...issue,
            file: displayFile
        };
    });
}
function groupIssues(issues) {
    const fileCounts = new Map();
    for (const issue of issues) {
        if (!issue.file) {
            continue;
        }
        fileCounts.set(issue.file, (fileCounts.get(issue.file) ?? 0) + 1);
    }
    if (fileCounts.size > 0) {
        return {
            title: "Files with most issues",
            items: sortCounts(fileCounts)
        };
    }
    const categoryCounts = new Map();
    for (const issue of issues) {
        const label = `${issue.tool}:${issue.category}`;
        categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
    }
    return {
        title: "Issue types",
        items: sortCounts(categoryCounts)
    };
}
function sortCounts(input) {
    return [...input.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([label, count]) => ({ label, count }));
}
function toDisplayPath(value) {
    if (!isAbsolute(value)) {
        return value;
    }
    const relativePath = relative(cwd(), value);
    if (relativePath === "" || relativePath.startsWith("..")) {
        return value;
    }
    return relativePath.replace(/\\/g, "/");
}
function getLikelyFirstFixTarget(issue) {
    if (!issue) {
        return undefined;
    }
    if (issue.file && issue.line !== undefined) {
        return issue.column !== undefined
            ? `${issue.file}:${issue.line}:${issue.column}`
            : `${issue.file}:${issue.line}`;
    }
    if (issue.file) {
        return issue.file;
    }
    if (issue.ruleOrCode) {
        return issue.ruleOrCode;
    }
    return issue.message;
}
function getRecommendedFixOrder(issues) {
    const order = [];
    const seenFiles = new Set();
    for (const issue of issues) {
        if (!issue.file) {
            continue;
        }
        if (seenFiles.has(issue.file)) {
            continue;
        }
        seenFiles.add(issue.file);
        order.push(`Fix issues in ${issue.file}`);
    }
    if (order.length > 0) {
        return order.slice(0, 5);
    }
    return issues.slice(0, 3).map((issue) => `Resolve ${issue.tool}:${issue.category} - ${issue.message}`);
}
