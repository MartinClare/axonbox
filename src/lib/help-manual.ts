import fs from "fs";
import path from "path";
import { parseHelpManual, type HelpManual } from "@/lib/help-markdown";

export function loadHelpManual(): HelpManual {
  const file = path.join(process.cwd(), "docs", "USER_MANUAL.md");
  try {
    return parseHelpManual(fs.readFileSync(file, "utf8"));
  } catch {
    return {
      title: "Help",
      intro: "User manual file is missing.",
      chapters: [],
    };
  }
}
