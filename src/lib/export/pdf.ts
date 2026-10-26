/** Install → PDF (FR-IN-06, FR-IO-07): one page per item: pre-snap diagram + routes + coach note. */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PlayThumbnail } from '@/components/field/PlayThumbnail';
import { installsRepo, matchupsRepo, playsRepo, settingsRepo } from '@/db/repos';
import { applyMatchupFlips } from '@/domain/matchupFlip';
import type { FieldConfig, ID, Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { downloadBlob } from './download';

const W = 480;
const H = 320;

async function renderDiagram(offense: Play, defense: Play, field: FieldConfig): Promise<string> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;display:flex;gap:8px;background:#fff;padding:8px;width:${W * 2 + 24}px`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(
        createElement(
          'div',
          { style: { display: 'flex', gap: 8 } },
          createElement(PlayThumbnail, { play: offense, field, width: W, height: H }),
          createElement(PlayThumbnail, { play: defense, field, width: W, height: H }),
        ),
      );
    });
    return await toPng(host, { pixelRatio: 2 });
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Render each item offscreen (PlayThumbnail-style pre-snap matchup diagram via html-to-image) and add it to
 * a jsPDF document (A4 landscape) with the item title and coach note text; save as `<install name>.pdf`.
 */
export async function exportInstallPdf(installId: ID): Promise<void> {
  const install = await installsRepo.get(installId);
  if (!install) throw new Error(`Install not found: ${installId}`);
  const settings = await settingsRepo.getOrDefault();
  const items = [...install.items].sort((a, b) => a.order - b.order);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let first = true;
  for (const [idx, item] of items.entries()) {
    const m = await matchupsRepo.get(item.matchupId);
    const [off, def] = m
      ? await Promise.all([playsRepo.get(m.offensePlayId), playsRepo.get(m.defensePlayId)])
      : [undefined, undefined];
    if (!first) doc.addPage();
    first = false;
    const title =
      m?.name || (off && def ? `${off.name} ${t.exportx.pdf.vs} ${def.name}` : t.install.missingMatchup);
    doc.setFontSize(16);
    doc.text(`${idx + 1}. ${title}`, margin, margin + 4);
    let noteY = margin + 14;
    if (m && off && def) {
      const flipped = applyMatchupFlips(off, def, m);
      const image = await renderDiagram(flipped.offense, flipped.defense, settings.fields[off.format]);
      const imgW = pageW - margin * 2;
      const imgH = imgW * ((H + 16) / (W * 2 + 24));
      doc.addImage(image, 'PNG', margin, margin + 10, imgW, imgH);
      noteY = margin + 10 + imgH + 8;
    }
    if (item.coachNote) {
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(item.coachNote, pageW - margin * 2);
      doc.text(lines, margin, noteY);
    }
  }
  if (items.length === 0) {
    doc.setFontSize(16);
    doc.text(install.name, margin, margin + 4);
  }
  downloadBlob(doc.output('blob'), `${install.name || 'install'}.pdf`);
}
