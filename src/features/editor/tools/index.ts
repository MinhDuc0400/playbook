/** Tool registry (lead-owned wiring). Phase 5 adds motion/option. */
import type { EditorTool, ToolId } from './types';
import { selectTool } from './selectTool';
import { placeTool } from './placeTool';
import { routeTool } from './routeTool';
import { manTool } from './manTool';
import { zoneTool } from './zoneTool';
import { rushTool } from './rushTool';

export const TOOLS: Partial<Record<ToolId, EditorTool>> = {
  select: selectTool,
  place: placeTool,
  route: routeTool,
  man: manTool,
  zone: zoneTool,
  rush: rushTool,
};

/** Tools offered per side, in toolbar order. */
export const TOOLBAR: Record<'offense' | 'defense', ToolId[]> = {
  offense: ['select', 'place', 'route'],
  defense: ['select', 'place', 'man', 'zone', 'rush'],
};
