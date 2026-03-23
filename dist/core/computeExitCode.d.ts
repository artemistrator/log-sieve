import type { FailOnMode, Summary } from "../types.js";
interface ComputeExitCodeInput {
    baseExitCode: number;
    failOn: FailOnMode;
    summary: Summary;
}
export declare function computeExitCode(input: ComputeExitCodeInput): number;
export {};
