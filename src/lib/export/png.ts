/** PNG export (FR-IO-07, FR-ED-09): html-to-image `toPng` on a DOM node, then download. */
import { toPng } from 'html-to-image';
import { downloadDataUrl } from './download';

export async function exportNodeToPng(node: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: false });
  downloadDataUrl(dataUrl, fileName.toLowerCase().endsWith('.png') ? fileName : `${fileName}.png`);
}
