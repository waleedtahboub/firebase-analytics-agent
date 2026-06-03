// Pulls the screen/frame inventory from a Figma file for cross-referencing.
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { statePaths, ensureStateDir } from "../session.js";

export function parseFigmaKey(urlOrKey: string): string | null {
  if (!urlOrKey) return null;
  if (!urlOrKey.includes("/")) return urlOrKey; // already a bare key
  const m = urlOrKey.match(/figma\.com\/(?:file|design|proto)\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export interface FigmaScreen {
  name: string;
  id: string;
  page: string;
  type: string;
}

export async function fetchFigmaScreens(
  urlOrKey: string,
  token: string
): Promise<{ key: string; fileName: string; screens: FigmaScreen[] }> {
  const key = parseFigmaKey(urlOrKey);
  if (!key) throw new Error(`Could not parse a Figma file key from "${urlOrKey}"`);
  const res = await fetch(`https://api.figma.com/v1/files/${key}?depth=2`, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Figma API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const screens: FigmaScreen[] = [];
  for (const page of data?.document?.children ?? []) {
    const pageName: string = page?.name ?? "";
    for (const node of page?.children ?? []) {
      const t = node?.type;
      if (t === "FRAME" || t === "SECTION" || t === "COMPONENT") {
        screens.push({ name: node.name, id: node.id, page: pageName, type: t });
      }
    }
  }
  return { key, fileName: data?.name ?? "", screens };
}

export function makeFigmaTool(ctx: { projectPath: string; figmaToken?: string }) {
  return tool(
    "figma_get_screens",
    "Fetch the screen/frame inventory of a Figma file: each top-level frame (a screen) with its name and page. Use it to cross-reference designed screens against the Flutter routes/widgets and to spot screens or states (empty/error/success) the code alone does not reveal.",
    { fileUrlOrKey: z.string().describe("Figma file URL or bare file key") },
    async (args: { fileUrlOrKey: string }) => {
      if (!ctx.figmaToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: "FIGMA_TOKEN is not set; skipping Figma. Continue using the codebase only.",
            },
          ],
        };
      }
      try {
        const result = await fetchFigmaScreens(args.fileUrlOrKey, ctx.figmaToken);
        ensureStateDir(ctx.projectPath);
        writeFileSync(
          statePaths(ctx.projectPath).figmaMappings,
          JSON.stringify(result, null, 2),
          "utf8"
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Figma fetch failed: ${e?.message ?? e}. Continue using the codebase only.`,
            },
          ],
        };
      }
    }
  );
}
