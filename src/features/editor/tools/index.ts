/** Tool registry (lead-owned wiring). */
import type { EditorTool, ToolId } from './types';
import { selectTool } from './selectTool';
import { placeTool } from './placeTool';
import { routeTool } from './routeTool';
import { manTool } from './manTool';
import { zoneTool } from './zoneTool';
import { rushTool } from './rushTool';
import { motionTool } from './motionTool';
import { optionTool } from './optionTool';

export const TOOLS: Partial<Record<ToolId, EditorTool>> = {
  select: selectTool,
  place: placeTool,
  route: routeTool,
  man: manTool,
  zone: zoneTool,
  rush: rushTool,
  motion: motionTool,
  option: optionTool,
};

/** Tools offered per side, in toolbar order. */
export const TOOLBAR: Record<'offense' | 'defense', ToolId[]> = {
  offense: ['select', 'place', 'route', 'option', 'motion'],
  defense: ['select', 'place', 'man', 'zone', 'rush'],
};
