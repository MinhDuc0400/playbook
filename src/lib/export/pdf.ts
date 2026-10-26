/** Install → PDF (FR-IN-06, FR-IO-07): one page per item: pre-snap diagram + routes + coach note. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID } from '@/domain/types';

/**
 * Render each item offscreen (PlayThumbnail-style pre-snap matchup diagram via html-to-image) and add it to
 * a jsPDF document (A4 landscape) with the item title and coach note text; save as `<install name>.pdf`.
 */
export async function exportInstallPdf(installId: ID): Promise<void> {
  return notImplemented(`exportInstallPdf ${installId}`);
}
