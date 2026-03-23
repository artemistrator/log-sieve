import { cleanLog } from "./cleanLog.js";
import { createReportView } from "./reportView.js";
import { dedupeIssues } from "./dedupeIssues.js";
import { prioritizeIssues } from "./prioritizeIssues.js";
import { createSummaryFromIssues, summarizeLog } from "./summarizeLog.js";
import { runCommand } from "./runCommand.js";
import type { MultiRunSummary, RenderOptions, RunSummary, Summary, ToolName } from "../types.js";

export async function executeRuns(commands: string[]): Promise<RunSummary[]> {
  const runs: RunSummary[] = [];

  for (const command of commands) {
    const result = await runCommand(command);
    runs.push({
      command,
      exitCode: result.exitCode,
      summary: summarizeLog(result.rawInput),
      cleanedLog: cleanLog(result.rawInput)
    });
  }

  return runs;
}

export function createMultiRunSummary(runs: RunSummary[], options: RenderOptions): MultiRunSummary {
  const aggregateSummary = createAggregateSummary(runs);
  const mostInformativeRunIndex = getMostInformativeRunIndex(runs, aggregateSummary);
  const downstreamRunIndexes = getDownstreamRunIndexes(runs, aggregateSummary, mostInformativeRunIndex);
  const aggregateView = createReportView(aggregateSummary, options);

  const summary: MultiRunSummary = {
    runs,
    aggregateSummary,
    mostInformativeRunIndex,
    downstreamRunIndexes,
    nextStep: aggregateSummary.nextStep
  };

  if (aggregateView.likelyFirstFixTarget) {
    summary.bestFirstFixTarget = aggregateView.likelyFirstFixTarget;
  }

  return summary;
}

export function getMultiRunBaseExitCode(runs: RunSummary[]): number {
  return runs.find((run) => run.exitCode !== 0)?.exitCode ?? 0;
}

function createAggregateSummary(runs: RunSummary[]): Summary {
  const combinedIssues = prioritizeIssues(
    dedupeIssues(runs.flatMap((run) => run.summary.issues))
  );
  const fallbackSummary = summarizeLog("");
  const detectedTool = (combinedIssues[0]?.tool as ToolName | undefined)
    ?? runs.find((run) => run.summary.issues.length > 0)?.summary.detectedTool
    ?? fallbackSummary.detectedTool;

  return createSummaryFromIssues(
    detectedTool,
    runs.reduce((count, run) => count + run.summary.totalIssues, 0),
    combinedIssues
  );
}

function getMostInformativeRunIndex(runs: RunSummary[], aggregateSummary: Summary): number {
  if (runs.length === 0) {
    return 0;
  }

  const targetPrimary = aggregateSummary.primaryBlocker;
  let bestIndex = 0;
  let bestScore = scoreRun(runs[0], targetPrimary);

  for (let index = 1; index < runs.length; index += 1) {
    const run = runs[index];
    if (!run) {
      continue;
    }

    const score = scoreRun(run, targetPrimary);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  return bestIndex;
}

function getDownstreamRunIndexes(
  runs: RunSummary[],
  aggregateSummary: Summary,
  mostInformativeRunIndex: number
): number[] {
  if (
    aggregateSummary.primaryBlocker !== "TypeScript compile/typecheck errors" &&
    aggregateSummary.primaryBlocker !== "Module or import resolution errors"
  ) {
    return [];
  }

  return runs.flatMap((run, index) => {
    if (index === mostInformativeRunIndex) {
      return [];
    }

    const hasOnlyTestSignals =
      run.summary.issues.length > 0 &&
      run.summary.issues.every((issue) => issue.tool === "test");

    return hasOnlyTestSignals ? [index] : [];
  });
}

function scoreRun(run: RunSummary | undefined, targetPrimary: string | undefined): number {
  if (!run) {
    return Number.MIN_SAFE_INTEGER;
  }

  const topIssue = run.summary.issues[0];
  const blockerBonus = run.summary.primaryBlocker === targetPrimary ? 1000 : 0;
  const structuredBonus = run.summary.issues.length * 10;
  const issueScore = topIssue?.priority === "high" ? 100 : topIssue?.priority === "medium" ? 50 : 10;
  const toolBonus = topIssue?.tool === "tsc" ? 20 : topIssue?.tool === "test" ? 10 : 0;

  return blockerBonus + structuredBonus + issueScore + toolBonus;
}
