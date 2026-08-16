import fs from "fs";
import path from "path";
import { markdownToHtml } from "@/lib/help-markdown";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  const file = path.join(process.cwd(), "docs", "USER_MANUAL.md");
  let md = "";
  try {
    md = fs.readFileSync(file, "utf8");
  } catch {
    md = "# Help\n\nUser manual file is missing.";
  }
  const html = markdownToHtml(md);

  return (
    <article className="axon-page mx-auto max-w-3xl">
      <div
        className="help-manual"
        // Markdown is authored in-repo (docs/USER_MANUAL.md), not user HTML.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
