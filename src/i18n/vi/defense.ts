/** Defense editor strings (NFR-UX-04). Owned by T2.4 (panel) — T2.2/T2.3 add tool hints under their keys. */
export const defense = {
  panel: 'Thuộc tính defense',
  play: {
    title: 'Play',
    ghostFormation: 'Ghost offense',
    alignTo: 'Căn theo',
    alignBall: 'Bóng (ball)',
    alignStrength: 'Strength',
    autoAlignAll: 'Tự căn tất cả',
  },
  defender: {
    title: 'Defender đang chọn',
    empty: 'Chọn một defender để chỉnh assignment.',
    label: 'Nhãn',
    leverage: 'Leverage',
    assignment: 'Assignment',
    clear: 'Xóa assignment',
    autoAlign: 'Tự căn',
  },
  leverage: {
    none: 'Không đặt',
    inside: 'Inside',
    outside: 'Outside',
    headUp: 'Head-up',
  },
  assignmentKind: {
    none: 'Chưa có',
    man: 'Man',
    zone: 'Zone',
    rush: 'Rush',
    spy: 'Spy',
  },
  man: {
    target: 'Mục tiêu',
    targetHint: 'Dùng tool Man (M) để đổi',
    strong: 'Strong',
    weak: 'Weak',
    technique: 'Technique',
    trail: 'Trail',
    cushion: 'Cushion',
    cushionYards: 'Cushion (yd)',
  },
  zone: {
    preset: 'Zone mẫu',
    custom: 'Polygon tự vẽ',
    makeZone: 'Chuyển sang zone',
  },
  rush: {
    toggle: 'Rusher',
    count: 'Rusher',
    over: 'vượt giới hạn',
  },
} as const;
