export function formatJson(summary, issues, truncated, omittedIssues, pretty) {
    const payload = {
        detectedTool: summary.detectedTool,
        totalIssues: summary.totalIssues,
        uniqueIssues: summary.uniqueIssues,
        issues,
        nextStep: summary.nextStep,
        rootCauseHint: summary.rootCauseHint,
        truncated,
        omittedIssues
    };
    return JSON.stringify(payload, null, pretty ? 2 : 0);
}
