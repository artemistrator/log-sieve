import type { Issue, ToolName } from "../types.js";
export declare function detectFormat(input: string): ToolName;
export declare function selectBestFormat(input: string): {
    tool: ToolName;
    issues: Issue[];
};
