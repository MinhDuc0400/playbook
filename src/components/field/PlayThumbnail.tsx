/**
 * Static SVG thumbnail of a play (FR-PB-01): positions + routes/assignments, no interaction, no zoom.
 * Fits the rect x ∈ sidelines, y ∈ [−8, 20] into width × height via fitViewport and renders FieldSvg
 * (no badge) + PlayerTokens + RoutePaths (offense routes; defense: zones, man lines to the default ghost,
 * rush arrows). `flipped` draws flipPlay(play) (FR-FLP-05 later).
 */
import type { FieldConfig, Play } from '@/domain/types';

export interface PlayThumbnailProps {
  play: Play;
  field: FieldConfig;
  width?: number; // px, default 240
  height?: number; // px, default 160
  flipped?: boolean;
  className?: string;
}

export function PlayThumbnail(_props: PlayThumbnailProps): JSX.Element | null {
  return null;
}
