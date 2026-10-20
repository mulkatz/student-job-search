import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  type ProfileDraft,
  type ProfileFact,
  profilePolicy,
} from "./profile-schema.js";

export class ProfileError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
export function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Inert Poppler extraction only. No shell, URL loading, OCR or model is involved. */
function poppler(
  command: "pdfinfo" | "pdftotext",
  args: string[],
  bytes: Buffer,
  maximumOutput: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: process.env.PATH ?? "", LANG: "C", LC_ALL: "C" },
    });
    const output: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: ProfileError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        child.kill("SIGKILL");
        reject(error);
      } else resolve(Buffer.concat(output).toString("utf8"));
    };
    const timeout = setTimeout(
      () => finish(new ProfileError(422, "pdf_limits_exceeded")),
      5000,
    );
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maximumOutput)
        finish(new ProfileError(422, "pdf_limits_exceeded"));
      else output.push(chunk);
    });
    // Drain, never log/return parser diagnostics (they may contain source text).
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", () =>
      finish(new ProfileError(503, "pdf_tool_unavailable")),
    );
    child.on("close", (code) =>
      finish(
        code === 0 ? undefined : new ProfileError(422, "pdf_parse_failed"),
      ),
    );
    child.stdin.end(bytes);
  });
}

export async function extractProfilePdf(
  bytes: Buffer,
  options: { realProfileProcessing?: boolean } = {},
): Promise<Pick<ProfileDraft, "outcome" | "pages" | "facts">> {
  if (bytes.length > profilePolicy.maximumPdfBytes)
    throw new ProfileError(413, "pdf_too_large");
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
    return { outcome: "parse_failed", pages: [], facts: [] };
  try {
    const info = await poppler("pdfinfo", ["-"], bytes, 32_768);
    if (/Encrypted:\s+yes/i.test(info))
      return { outcome: "encrypted", pages: [], facts: [] };
    const count = Number(/^Pages:\s+(\d+)\s*$/m.exec(info)?.[1]);
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > profilePolicy.maximumPages
    )
      return { outcome: "limits_exceeded", pages: [], facts: [] };
    const text = await poppler(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", "-", "-"],
      bytes,
      profilePolicy.maximumText * 4,
    );
    if (text.length > profilePolicy.maximumText)
      return { outcome: "limits_exceeded", pages: [], facts: [] };
    const pageTexts = text.split("\f");
    if (!pageTexts.at(-1)?.trim()) pageTexts.pop();
    if (pageTexts.length !== count)
      return { outcome: "parse_failed", pages: [], facts: [] };
    const pages = pageTexts.map((page, index) => ({
      page: index + 1,
      text: page.trim(),
    }));
    if (!pages.some((page) => page.text.trim().length >= 20))
      return { outcome: "needs_review", pages, facts: [] };
    // Real processing is enabled only by the explicitly configured private pilot.
    if (!options.realProfileProcessing && !text.includes("SYNTHETIC"))
      return { outcome: "synthetic_only", pages: [], facts: [] };
    const facts: ProfileFact[] = [];
    const labels = new Map<string, ProfileFact["category"]>([
      ["working language", "working_language"],
      ["skill", "skill"],
      ["employment preference", "employment_preference"],
      ["location preference", "location_preference"],
      ["weekly availability hours", "weekly_availability_hours"],
      ["work authorization", "work_authorization"],
    ]);
    for (const page of pages)
      for (const [index, line] of page.text.split("\n").entries()) {
        const match =
          /^\s*(Working language|Skill|Employment preference|Location preference|Weekly availability hours|Work authorization):\s*(.{1,300})\s*$/i.exec(
            line,
          );
        if (!match?.[1] || !match[2]) continue;
        const category = labels.get(match[1].toLowerCase());
        if (!category || facts.length >= 20) continue;
        facts.push({
          id: `fact_${contentHash([page.page, index, line]).slice(0, 32)}`,
          category,
          value: match[2].trim(),
          provenance: {
            kind: "pdf_quote",
            page: page.page,
            quote: line.trim(),
          },
        });
      }
    return { outcome: "text_extracted", pages, facts };
  } catch (error: unknown) {
    if (error instanceof ProfileError && error.status === 503) throw error;
    return {
      outcome:
        error instanceof ProfileError && error.code === "pdf_limits_exceeded"
          ? "limits_exceeded"
          : "parse_failed",
      pages: [],
      facts: [],
    };
  }
}
