import { dedupeIssues } from "./dedupeIssues.js";
import { parseEslint } from "../parsers/eslintParser.js";
import { parseGeneric } from "../parsers/genericParser.js";
import { parseTest } from "../parsers/testParser.js";
import { parseTsc } from "../parsers/tscParser.js";
const parsers = {
    tsc: parseTsc,
    eslint: parseEslint,
    test: parseTest,
    generic: parseGeneric
};
const parserWeight = {
    tsc: 6,
    test: 5,
    eslint: 4,
    generic: 1
};
export function detectFormat(input) {
    return selectBestFormat(input).tool;
}
export function selectBestFormat(input) {
    const knownResults = Object.entries(parsers)
        .filter(([tool]) => tool !== "generic")
        .map(([tool, parse]) => ({
        tool,
        issues: parse(input)
    }));
    const structuredResults = knownResults.filter((result) => result.issues.length > 0);
    if (structuredResults.length > 0) {
        const dominant = selectDominantResult(structuredResults);
        return {
            tool: dominant.tool,
            issues: structuredResults.flatMap((result) => result.issues)
        };
    }
    const results = Object.entries(parsers).map(([tool, parse]) => ({
        tool,
        issues: parse(input)
    }));
    const firstResult = results[0];
    if (!firstResult) {
        return { tool: "generic", issues: [] };
    }
    let best = firstResult;
    let bestScore = getParseScore(best.tool, best.issues);
    for (const candidate of results.slice(1)) {
        const candidateScore = getParseScore(candidate.tool, candidate.issues);
        if (candidateScore > bestScore || (candidateScore === bestScore && breaksTie(candidate, best))) {
            best = candidate;
            bestScore = candidateScore;
        }
    }
    return bestScore > 0 ? best : { tool: "generic", issues: [] };
}
function selectDominantResult(results) {
    const firstResult = results[0];
    if (!firstResult) {
        return { tool: "generic", issues: [] };
    }
    let best = firstResult;
    let bestScore = getParseScore(best.tool, dedupeIssues(best.issues));
    for (const candidate of results.slice(1)) {
        const candidateScore = getParseScore(candidate.tool, dedupeIssues(candidate.issues));
        if (candidateScore > bestScore || (candidateScore === bestScore && breaksTie(candidate, best))) {
            best = candidate;
            bestScore = candidateScore;
        }
    }
    return best;
}
function getParseScore(tool, issues) {
    if (issues.length === 0) {
        return 0;
    }
    return issues.reduce((score, issue) => {
        let issueScore = parserWeight[tool];
        if (issue.file) {
            issueScore += 2;
        }
        if (issue.line !== undefined) {
            issueScore += 1;
        }
        if (issue.column !== undefined) {
            issueScore += 1;
        }
        if (issue.ruleOrCode) {
            issueScore += 1;
        }
        return score + issueScore;
    }, 0);
}
function breaksTie(candidate, best) {
    if (candidate.issues.length !== best.issues.length) {
        return candidate.issues.length > best.issues.length;
    }
    return parserWeight[candidate.tool] > parserWeight[best.tool];
}
