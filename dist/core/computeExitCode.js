export function computeExitCode(input) {
    let exitCode = input.baseExitCode;
    if (input.failOn === "none") {
        return exitCode;
    }
    const hasAnyIssues = input.summary.uniqueIssues > 0;
    const hasHighPriorityIssues = input.summary.issues.some((issue) => issue.priority === "high");
    const shouldFail = input.failOn === "any" ? hasAnyIssues : hasHighPriorityIssues;
    if (shouldFail && exitCode === 0) {
        exitCode = 1;
    }
    return exitCode;
}
