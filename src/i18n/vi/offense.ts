/** Offense panel strings incl. route template names (NFR-UX-04). Owned by T1.10. */
import type { RouteTemplateId } from '@/domain/routeTree';

const routeNames: Record<RouteTemplateId, string> = {
  hitch: 'Hitch',
  slant: 'Slant',
  out: 'Out',
  in: 'In',
  go: 'Go',
  post: 'Post',
  corner: 'Corner',
  curl: 'Curl',
  comeback: 'Comeback',
  flat: 'Flat',
  drag: 'Drag',
  wheel: 'Wheel',
  whip: 'Whip',
  'out-and-up': 'Out-and-up',
  sluggo: 'Sluggo',
};

export const offense = {
  panel: 'Thuộc tính offense',
  player: {
    title: 'Cầu thủ đang chọn',
    empty: 'Chọn một cầu thủ để chỉnh route.',
    label: 'Nhãn',
  },
  route: {
    title: 'Route tree',
    templates: 'Route mẫu',
    depth: 'Độ sâu (yd)',
    endBehavior: 'Cuối route',
    stop: 'Dừng lại',
    continue: 'Chạy tiếp',
    remove: 'Xóa route',
  },
  qb: {
    title: 'QB drop',
    depth: 'Độ sâu drop (yd)',
    style: 'Kiểu đứng',
    shotgun: 'Shotgun',
    under: 'Under center',
  },
  routeNames,
  progression: {
    title: 'Thứ tự đọc (progression)',
    empty: 'Chưa có. Bấm lần lượt các receiver bên dưới.',
    list: 'Thứ tự đọc hiện tại',
    toggle: 'Chọn receiver theo thứ tự đọc',
    clear: 'Xóa thứ tự',
  },
  strength: {
    title: 'Strength',
    label: 'Strength',
    auto: 'Tự động',
    left: 'Trái',
    right: 'Phải',
    balanced: 'Cân bằng',
  },
  preview: {
    open: 'Chạy thử',
    title: 'Chạy thử offense',
    close: 'Đóng',
    stage: 'Sân chạy thử',
  },
} as const;
