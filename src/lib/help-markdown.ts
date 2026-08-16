/** Minimal Markdown → HTML for the in-app Help page (no extra deps). */

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(s: string) {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-[var(--axon-blue)] underline" href="$2">$1</a>');
  t = t.replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 text-[13px]">$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

export function markdownToHtml(md: string): string {
  const lines = md.replaceAll("\r\n", "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let code: string[] = [];

  const flushP = (buf: string[]) => {
    const text = buf.join(" ").trim();
    if (text) out.push(`<p class="mb-3 text-sm leading-relaxed text-slate-700">${inline(text)}</p>`);
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        out.push(
          `<pre class="mb-4 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>${escapeHtml(code.join("\n"))}</code></pre>`,
        );
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      i += 1;
      continue;
    }
    if (inCode) {
      code.push(line);
      i += 1;
      continue;
    }

    if (line.trim() === "---") {
      out.push('<hr class="my-8 border-slate-200" />');
      i += 1;
      continue;
    }

    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      const alt = escapeHtml(img[1]);
      const src = escapeHtml(img[2]);
      out.push(
        `<figure class="my-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img src="${src}" alt="${alt}" class="w-full max-w-3xl bg-white" />
          <figcaption class="px-3 py-2 text-xs text-slate-500">${alt}</figcaption>
        </figure>`,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      const title = line.slice(4).trim();
      const id = slug(title);
      out.push(`<h3 id="${id}" class="mb-2 mt-8 text-base font-semibold text-[var(--axon-navy)]">${inline(title)}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      const id = slug(title);
      out.push(`<h2 id="${id}" class="mb-3 mt-10 border-b border-slate-200 pb-2 text-xl font-semibold text-[var(--axon-navy)]">${inline(title)}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      const title = line.slice(2).trim();
      out.push(`<h1 class="mb-4 text-2xl font-semibold text-[var(--axon-navy)]">${inline(title)}</h1>`);
      i += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      out.push(tableHtml(rows));
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i += 1;
      }
      out.push(
        `<ol class="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">${items
          .map((it) => `<li class="pl-1">${inline(it)}</li>`)
          .join("")}</ol>`,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      out.push(
        `<ul class="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-700">${items
          .map((it) => `<li>${inline(it)}</li>`)
          .join("")}</ul>`,
      );
      continue;
    }

    if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      out.push(`<p class="mb-3 text-sm italic text-slate-500">${inline(line.replace(/^\*|\*$/g, ""))}</p>`);
      i += 1;
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const buf = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |---|\d+\. |- |\| |!\[|```)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    flushP(buf);
  }

  return out.join("\n");
}

function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tableHtml(rows: string[]) {
  const parse = (r: string) =>
    r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
  const body = rows.filter((r) => !/^\|?\s*-+/.test(r.replaceAll("|", "").trim() ? r : "") && !/^[\s|:-]+$/.test(r));
  if (body.length === 0) return "";
  const header = parse(body[0]);
  const data = body.slice(1).filter((r) => !r.includes("---")).map(parse);
  return `<div class="mb-4 overflow-x-auto"><table class="w-full min-w-[28rem] text-left text-sm">
    <thead class="bg-slate-50 text-xs text-slate-500"><tr>${header.map((h) => `<th class="px-3 py-2 font-medium">${inline(h)}</th>`).join("")}</tr></thead>
    <tbody>${data
      .map(
        (cells) =>
          `<tr class="border-t border-slate-100">${cells.map((c) => `<td class="px-3 py-2 text-slate-700">${inline(c)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table></div>`;
}
