/** PNG export (FR-IO-07, FR-ED-09): html-to-image `toPng` on a DOM node, then download. */
import { notImplemented } from '@/domain/notImplemented';

export async function exportNodeToPng(node: HTMLElement, fileName: string): Promise<void> {
  return notImplemented(`exportNodeToPng ${String(node)}${fileName}`);
}
