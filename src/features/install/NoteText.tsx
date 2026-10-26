/** Renders a coach note: line breaks kept, "- " / "• " lines become bullets (FR-IN-03). */
import type { ReactNode } from 'react';

const BULLET = /^\s*(?:-|•)\s+(.*)$/;

export function NoteText({ text }: { text: string }): JSX.Element {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (): void => {
    if (bullets.length === 0) return;
    const key = `ul${blocks.length}`;
    blocks.push(
      <ul key={key} className="list-disc pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  text.split(/\r?\n/).forEach((line) => {
    const m = BULLET.exec(line);
    if (m) {
      bullets.push(m[1]!);
      return;
    }
    flush();
    blocks.push(
      <p key={`p${blocks.length}`} className="min-h-[1em]">
        {line}
      </p>,
    );
  });
  flush();
  return <div data-testid="note-text">{blocks}</div>;
}
