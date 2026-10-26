/** Export a DOM node to PNG (FR-ED-09, FR-IO-07). */
import { useState } from 'react';
import { Button } from '@/components/ui';
import { t } from '@/i18n/vi';
import { exportNodeToPng } from '@/lib/export/png';

export interface ExportPngButtonProps {
  getNode: () => HTMLElement | null;
  fileName: string;
}

export function ExportPngButton({ getNode, fileName }: ExportPngButtonProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (): Promise<void> => {
    const node = getNode();
    if (!node || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await exportNodeToPng(node, fileName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        data-testid="btn-export-png"
        title={t.exportx.png.help}
        disabled={busy}
        onClick={() => void run()}
      >
        {t.exportx.png.button}
      </Button>
      {failed ? (
        <span role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t.exportx.png.failed}
        </span>
      ) : null}
    </>
  );
}
