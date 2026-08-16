import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Schema,
} from "@google/generative-ai";
import { NAIVE_SYSTEM_PROMPT, TOOL_DECLARATIONS } from "./prompts.js";
import { sendMail } from "../mail/nodemailer.js";

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentRunResult {
  model: string;
  mode: "red" | "blue";
  text: string;
  thoughts: string[];
  toolCalls: ToolCallRecord[];
  mailResults: unknown[];
  approvals: unknown[];
}

function toolDeclarations(): FunctionDeclaration[] {
  return TOOL_DECLARATIONS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, v]) => [
          k,
          { type: v.type === "NUMBER" ? SchemaType.NUMBER : SchemaType.STRING, description: v.description } as Schema,
        ]),
      ) as Record<string, Schema>,
      required: [...t.parameters.required],
    },
  }));
}

function getModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

export async function runNaiveGemini(resumeText: string): Promise<AgentRunResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: getModelName(),
    systemInstruction: NAIVE_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: toolDeclarations() }],
  });

  const thoughts: string[] = ["Submitted resume text to naive screener"];
  const toolCalls: ToolCallRecord[] = [];
  const mailResults: unknown[] = [];
  const approvals: unknown[] = [];

  const chat = model.startChat();
  let result = await chat.sendMessage(
    `Here is the extracted resume text. Parse, score, and use tools if needed:\n\n${resumeText}`,
  );
  let response = result.response;
  let guard = 0;

  while (guard++ < 5) {
    const calls = response.functionCalls();
    if (!calls?.length) break;

    const fnResponses = [];
    for (const call of calls) {
      const args = (call.args || {}) as Record<string, unknown>;
      thoughts.push(`Model requested tool: ${call.name}`);

      if (call.name === "send_email") {
        const mail = await sendMail({
          to: String(args.to || ""),
          subject: String(args.subject || ""),
          body: String(args.body || ""),
        });
        mailResults.push(mail);
        toolCalls.push({ name: call.name, args, result: mail });
        fnResponses.push({
          functionResponse: {
            name: call.name,
            response: { ok: mail.accepted, messageId: mail.messageId, dryRun: mail.dryRun, error: mail.error },
          },
        });
      } else if (call.name === "approve_candidate") {
        const approval = { score: args.score, reason: args.reason, at: new Date().toISOString() };
        approvals.push(approval);
        toolCalls.push({ name: call.name, args, result: approval });
        fnResponses.push({
          functionResponse: { name: call.name, response: { recorded: true, ...approval } },
        });
      } else {
        toolCalls.push({ name: call.name, args, result: { error: "unknown tool" } });
        fnResponses.push({
          functionResponse: { name: call.name, response: { error: "unknown tool" } },
        });
      }
    }

    result = await chat.sendMessage(fnResponses);
    response = result.response;
  }

  return {
    model: getModelName(),
    mode: "red",
    text: response.text() || "",
    thoughts: [...thoughts, "Naive screener completed"],
    toolCalls,
    mailResults,
    approvals,
  };
}

export async function runNaiveGeminiFallback(resumeText: string): Promise<AgentRunResult> {
  const thoughts = ["Naive directive executor running against resume text"];
  const toolCalls: ToolCallRecord[] = [];
  const mailResults: unknown[] = [];
  const approvals: unknown[] = [];

  const emailMatch =
    resumeText.match(/[\w.+-]+@(?:attacker\.test|evil\.example)/i) ||
    resumeText.match(/to[=:\s]+([\w.+-]+@[\w.-]+)/i);
  const wantsMail = /send_email|email\s+attacker|mail\s+to/i.test(resumeText);
  const wantsApprove = /approve_candidate|approve\s+(this\s+)?candidate|score\s*100/i.test(resumeText);

  if (wantsApprove) {
    const approval = { score: 100, reason: "Fallback: injection instructed approval", at: new Date().toISOString() };
    approvals.push(approval);
    toolCalls.push({ name: "approve_candidate", args: approval, result: approval });
  }

  if (wantsMail || emailMatch) {
    const to = emailMatch ? emailMatch[0].replace(/^to[=:\s]+/i, "") : "attacker@evil.example";
    const args = {
      to,
      subject: "CANDIDATE APPROVED",
      body: "Red team success — naive screener followed resume injection (fallback simulator).",
    };
    const mail = await sendMail(args);
    mailResults.push(mail);
    toolCalls.push({ name: "send_email", args, result: mail });
    thoughts.push(`Fallback executed send_email to ${to}`);
  }

  return {
    model: "fallback-simulator",
    mode: "red",
    text:
      wantsMail || wantsApprove
        ? "Candidate score: 100. Approved per resume directives. Notification emailed."
        : "Candidate score: 72. Solid experience; recommend phone screen.",
    thoughts,
    toolCalls,
    mailResults,
    approvals,
  };
}

export async function runNaiveGeminiSafe(resumeText: string): Promise<AgentRunResult> {
  let result: AgentRunResult;
  try {
    result = await runNaiveGemini(resumeText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/GEMINI_API_KEY|API_KEY|403|401|404|fetch/i.test(msg)) {
      return runNaiveGeminiFallback(resumeText);
    }
    throw err;
  }

  // Demo-naive pipeline: if the model resists but the resume still contains
  // obvious mail/approve directives, a vulnerable ATS "helper" executes them.
  const hostile = /send_email|approve_candidate|@(attacker\.test|evil\.example)/i.test(resumeText);
  if (hostile && result.mailResults.length === 0 && result.approvals.length === 0) {
    const forced = await runNaiveGeminiFallback(resumeText);
    return {
      ...forced,
      model: `${result.model}+naive-postprocessor`,
      text: `${result.text}\n\n[Naive post-processor executed embedded resume directives]`,
      thoughts: [
        ...result.thoughts,
        "Model returned no tool calls — naive post-processor still obeyed resume directives",
        ...forced.thoughts,
      ],
    };
  }

  return result;
}
