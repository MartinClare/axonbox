import Link from "next/link";
import { markdownToHtml } from "@/lib/help-markdown";
import { loadHelpManual } from "@/lib/help-manual";

export const dynamic = "force-dynamic";

export default function HelpIndexPage() {
  const manual = loadHelpManual();
  const introHtml = markdownToHtml(manual.intro);

  return (
    <article className="axon-page mx-auto max-w-3xl">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--axon-steel)]">
          Help
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--axon-navy)]">{manual.title}</h1>
      </header>

      <div
        className="help-manual"
        dangerouslySetInnerHTML={{ __html: introHtml }}
      />

      <nav aria-label="Table of contents" className="rounded-2xl border border-[var(--axon-line)] bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--axon-navy)]">Contents</h2>
        <ol className="space-y-3">
          {manual.chapters.map((chapter) => (
            <li key={chapter.slug}>
              <Link
                href={`/help/${chapter.slug}`}
                className="font-semibold text-[var(--axon-navy)] hover:text-[var(--axon-blue)] hover:underline"
              >
                {chapter.title}
              </Link>
              {chapter.subsections.length > 0 && (
                <ol className="mt-1.5 space-y-1 border-l border-slate-200 pl-4">
                  {chapter.subsections.map((section) => (
                    <li key={section.slug}>
                      <Link
                        href={`/help/${chapter.slug}#${section.slug}`}
                        className="text-sm text-slate-600 hover:text-[var(--axon-blue)] hover:underline"
                      >
                        {section.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </article>
  );
}
