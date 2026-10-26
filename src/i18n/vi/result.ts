/** Matchup result panel strings. Owned by T3.12. */
export const result = {
  title: 'Kết quả',
  outcome: {
    complete: 'Hoàn thành',
    incomplete: 'Không bắt được',
    deflected: 'Bị gạt',
    intercepted: 'Bị INT',
    sack: 'Sack',
    throwaway: 'Ném bỏ',
    timeout: 'Hết giờ (7 s)',
  },
  target: 'Mục tiêu',
  yards: 'Cự ly',
  yardsUnit: 'yd',
  outcomeTime: 'Thời điểm',
  timeToThrow: 'Time to throw',
  secondsUnit: 's',
  receiver: 'Receiver',
  separationAtThrow: 'Separation lúc ném',
  openWindow: 'Open window',
  none: '—',
  decision: 'Quyết định',
  readTimeline: {
    title: 'Timeline đọc',
    toggle: 'Ẩn/hiện timeline đọc',
    scores: 'Điểm đọc',
    threshold: (v: number): string => `ngưỡng ${v}`,
    window: (n: number, from: number, to: number, auto: boolean): string =>
      `#${n} ${auto ? 'tự động' : 'thủ công'} ${from.toFixed(2)}–${to.toFixed(2)} s (${(to - from).toFixed(2)} s)`,
    open: (from: number, to: number): string =>
      `mở ${from.toFixed(2)}–${to.toFixed(2)} s (${(to - from).toFixed(2)} s)`,
    duration: (sec: number): string => `${sec.toFixed(2)} s`,
    decision: {
      read: (n: number, label: string, score?: number): string =>
        `Ném #${n} (${label})${score === undefined ? '' : ` · điểm ${Math.round(score)}`}`,
      checkdown: (label: string): string => `Check-down (${label})`,
      forced: (label: string): string => `Bị ép → ${label}`,
      manual: (label: string): string => `Bạn ném → ${label}`,
      throwaway: 'Ném bỏ',
      none: 'Không ném',
    },
  },
  readDistribution: {
    title: 'Phân bố quyết định',
    read: (n: number): string => `Đọc #${n}`,
    checkdown: 'Check-down',
    forced: 'Bị ép',
    manual: 'Bạn ném',
    throwaway: 'Ném bỏ',
    none: 'Không ném',
  },
} as const;
