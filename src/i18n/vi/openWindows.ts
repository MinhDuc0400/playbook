/** "Khoảng open" panel strings (D-26). */
export const openWindows = {
  title: 'Khoảng open',
  help: 'Phần xanh = lúc receiver cách người kèm đủ xa để nhận bóng.',
  segment: (from: number, to: number): string =>
    `mở ${from.toFixed(2)}–${to.toFixed(2)} s (${(to - from).toFixed(2)} s)`,
  total: (sec: number): string => `${sec.toFixed(2)} s`,
  readBadge: (n: number): string => `#${n}`,
  throwMarker: (t: number): string => `Ném bóng ${t.toFixed(2)} s`,
  complete: 'Bắt được',
  incomplete: 'Không bắt được',
  summary: (label: string, from: number, to: number, total: number): string =>
    `${label} mở lâu nhất: ${from.toFixed(2)}–${to.toFixed(2)} s (${total.toFixed(2)} s)`,
  nobody: (open: number): string => `Không receiver nào mở ≥ ${open} yd`,
} as const;
