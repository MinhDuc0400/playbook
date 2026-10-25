/**
 * "Chạy thử" (FR-OFF-06): replaces the editor canvas while store.previewing. Runs previewOffense once per
 * play change, renders its own FieldStage with PlayerTokens at frameAt(frames, t), planned routes faded,
 * and a Timeline (autoPlay). A close button calls onClose.
 */
import type { BallSpot, FieldConfig, TuningParams } from '@/domain/types';

export interface PreviewOverlayProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  tuning: TuningParams;
  onClose(): void;
}

export function PreviewOverlay(_props: PreviewOverlayProps): JSX.Element | null {
  return null;
}
