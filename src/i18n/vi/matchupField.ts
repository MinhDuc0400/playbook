/** Matchup field, overlays, player panel strings. Owned by T3.11. */
export const matchupField = {
  overlays: {
    plannedRoutes: 'Route dự kiến',
    trails: 'Vệt chạy thật',
    zones: 'Zone',
    manLines: 'Đường man',
    ballPath: 'Đường bóng bay',
    separation: 'Separation',
  },
  levels: {
    weak: 'Kém',
    avg: 'TB',
    good: 'Hay',
    custom: 'Tùy chỉnh',
  },
  panel: {
    title: 'Cầu thủ',
    hint: 'Bấm vào một cầu thủ trên sân để chọn trình độ.',
    sideOffense: 'Tấn công',
    sideDefense: 'Phòng thủ',
    level: 'Trình độ',
    keysHint: 'Phím tắt: 1 = Kém, 2 = TB, 3 = Hay',
  },
  ballLabel: 'Bóng',
} as const;
