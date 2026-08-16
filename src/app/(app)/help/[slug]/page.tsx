import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { markdownToHtml } from "@/lib/help-markdown";
import { loadHelpManual } from "@/lib/help-manual";

export const dynamic = "force-dynamic";

export default async function HelpChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const manual = loadHelpManual();
  const index = manual.chapters.findIndex((c) => c.slug === slug);
  if (index < 0) notFound();

  const chapter = manual.chapters[index];
  const prev = manual.chapters[index - 1];
  const next = manual.chapters[index + 1];
  const html = markdownToHtml(chapter.markdown);

  return (
    <article className="axon-page mx-auto max-w-3xl">
      <p className="text-sm">
        <Link href="/help" className="text-[var(--axon-blue)] hover:underline">
          ← Contents
        </Link>
      </p>

      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--axon-steel)]">
          Help · {index + 1} of {manual.chapters.length}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--axon-navy)]">{chapter.title}</h1>
      </header>

      {chapter.subsections.length > 1 && (
        <nav className="rounded-xl border border-[var(--axon-line)] bg-white px-4 py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            In this chapter
          </div>
          <ul className="space-y-1">
            {chapter.subsections.map((section) => (
              <li key={section.slug}>
                <a
                  href={`#${section.slug}`}
                  className="text-sm text-slate-600 hover:text-[var(--axon-blue)] hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div
        className="help-manual"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <nav className="flex items-stretch justify-between gap-3 border-t border-slate-200 pt-5">
        {prev ? (
          <Link
            href={`/help/${prev.slug}`}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--axon-line)] bg-white px-3 py-3 text-sm hover:border-[var(--axon-blue)]"
          >
            <ChevronLeft size={16} className="shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Previous</span>
              <span className="block truncate font-medium text-[var(--axon-navy)]">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/help/${next.slug}`}
            className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-xl border border-[var(--axon-line)] bg-white px-3 py-3 text-right text-sm hover:border-[var(--axon-blue)]"
          >
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Next</span>
              <span className="block truncate font-medium text-[var(--axon-navy)]">{next.title}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </Link>
        ) : (
          <Link
            href="/help"
            className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-xl border border-[var(--axon-line)] bg-white px-3 py-3 text-right text-sm hover:border-[var(--axon-blue)]"
          >
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Done</span>
              <span className="block truncate font-medium text-[var(--axon-navy)]">Back to contents</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </Link>
        )}
      </nav>
    </article>
  );
}
