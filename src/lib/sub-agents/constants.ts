/**
 * List of devark sub-agents for Claude Code
 * These sub-agents are installed to ~/.claude/agents/ for local analysis
 * Streamlined to 2 essential agents for fast, focused reports
 */
export const DEVARK_SUB_AGENTS = [
  'devark-session-analyzer.md',
  'devark-report-generator.md'
] as const;

export type SubAgentName = typeof DEVARK_SUB_AGENTS[number];