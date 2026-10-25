/** Tool registry (lead-owned wiring). Phase 2 adds man/zone/rush, phase 5 motion/option. */
import type { EditorTool, ToolId } from './types';
import { selectTool } from './selectTool';
import { placeTool } from './placeTool';
import { routeTool } from './routeTool';

export const TOOLS: Partial<Record<ToolId, EditorTool>> = {
  select: selectTool,
  place: placeTool,
  route: routeTool,
};

/** Tools offered per side, in toolbar order. */
export const TOOLBAR: Record<'offense' | 'defense', ToolId[]> = {
  offense: ['select', 'place', 'route'],
  defense: ['select', 'place'],
};
