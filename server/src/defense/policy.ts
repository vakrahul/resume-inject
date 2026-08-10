import { isRecipientAllowed } from "../mail/interceptor.js";

export type ToolName = "send_email" | "approve_candidate";

export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

export function evaluateToolPolicy(tool: ToolName, args: Record<string, unknown>): PolicyDecision {
  if (tool === "approve_candidate") {
    return {
      allow: false,
      reason: "approve_candidate is disabled on Blue path — human recruiter must decide",
    };
  }
  if (tool === "send_email") {
    const to = String(args.to || "");
    if (!to) return { allow: false, reason: "missing recipient" };
    if (!isRecipientAllowed(to)) {
      return { allow: false, reason: `recipient domain not in EMAIL_DOMAIN_WHITELIST: ${to}` };
    }
    return { allow: true, reason: "recipient on whitelist" };
  }
  return { allow: false, reason: "unknown tool" };
}
