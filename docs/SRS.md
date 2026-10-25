# Flag Football Playbook — SRS

Oct 25, 2026 · @Duc

Web app cá nhân để vẽ, lưu, ghép và xem animation các play flag football giữa offense và defense, chạy hoàn toàn trên trình duyệt (React + IndexedDB), không cần backend.

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu này mô tả đầy đủ yêu cầu để bắt đầu code. Mỗi yêu cầu có mã (FR-xxx, NFR-xxx) để tham chiếu trong task, commit và test.

### 1.2 Phạm vi (in scope)

- Vẽ play offense (route, motion) và defense (man, zone, rush, leverage, luật pattern match).
- Lật play trái/phải (flip).
- Chỉ số cầu thủ theo preset Kém / Trung bình / Hay, chỉnh chi tiết bằng slider.
- Ghép 1 play offense với 1 play defense thành matchup, xem animation.
- Engine mô phỏng: mỗi cầu thủ chỉ phản ứng theo những gì thấy được, không biết trước play bên kia.
- Playbook, Install playlist, chế độ trình chiếu.
- Suggest (tag, độ mở, mismatch) và Random defense.
- Lưu local bằng IndexedDB, import/export JSON, export PNG/PDF.

### 1.3 Ngoài phạm vi (out of scope)

- Chế độ đấu (2 người chọn play kín, online, play-call game).
- Tài khoản, đăng nhập, backend, đồng bộ cloud. Có thể làm sau, xem mục 15.
- Chạy bóng (run play) có mô phỏng va chạm, đuổi rút cờ. MVP chỉ mô phỏng pha chuyền.
- Ứng dụng mobile native.

### 1.4 Thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| LOS | Line of scrimmage, vạch bóng đặt trước snap |
| Play | Sơ đồ chiến thuật của 1 bên (offense hoặc defense) |
| Matchup | 1 play offense ghép với 1 play defense để xem |
| Install | Playlist các matchup kèm ghi chú, dùng để dạy/ôn |
| Strength | Phía mạnh của offense (phía nhiều receiver hơn) |
| #1, #2, #3 | Số receiver đếm từ ngoài vào trong, theo từng phía |
| Leverage | Defender đứng lệch inside/outside so với receiver |
| Perception | Những gì 1 cầu thủ nhìn thấy tại thời điểm t, có độ trễ |
| Anticipation | Mức defense được phép đoán trước, 0 đến 1 |
| Separation | Khoảng cách từ receiver tới defender gần nhất |
| Athlete | 1 cầu thủ (thật hoặc giả định) có bộ chỉ số |
| Lineup | Danh sách gán Athlete hoặc preset vào từng vị trí |

## 2. Tổng quan sản phẩm

App dành cho 1 người dùng (bản thân tác giả), dùng để tự thiết kế và xem install offense/defense, chạy trên laptop, có thể mở trên tablet để xem.

### 2.1 Hai chế độ dùng chính

| Chế độ | Mục đích | Thấy gì |
| --- | --- | --- |
| Thiết kế (Editor) | Vẽ, sửa 1 play | Chỉ play đang sửa |
| Phân tích (Matchup / Install) | Xem play offense vs defense chạy animation | Cả 2 play, người xem thấy hết. Cầu thủ trong sim thì không thấy play bên kia |

Phân biệt quan trọng: **người dùng** biết cả 2 play, nhưng **cầu thủ trong engine** chỉ biết những gì họ nhìn thấy (mục 8).

### 2.2 Luồng sử dụng chính

1. Tạo play offense: chọn format, đặt cầu thủ, vẽ route, gắn tag, lưu.
2. Tạo play defense: đặt cầu thủ, gán man/zone/rush, leverage, luật match, lưu.
3. Tạo matchup: chọn 1 offense + 1 defense, chọn flip, lineup, mức anticipation.
4. Xem animation, kéo timeline, slow-mo, xem chỉ số separation.
5. Gom nhiều matchup vào Install, thêm ghi chú, trình chiếu.
6. Dùng Suggest để tìm play đánh được 1 coverage, hoặc Random defense để tự luyện đọc.

### 2.3 Ràng buộc

- Chạy 100% client-side. Không gọi API ngoài ở MVP.
- Dữ liệu nằm trong IndexedDB của 1 trình duyệt. Mất nếu xóa dữ liệu trình duyệt, nên bắt buộc có export/import JSON.
- Trình duyệt mục tiêu: Chrome, Edge, Safari bản mới nhất. Màn hình tối thiểu 1024 px cho Editor.

### 2.4 Giả định

- Mô phỏng là gần đúng để học chiến thuật, không phải vật lý chính xác.
- Không có tiếp xúc (đúng luật flag), nên không mô phỏng block hay jam.
- Pha chuyền kết thúc khi bóng được bắt, rơi, bị gạt, bị chặn, hoặc QB bị rút cờ (sack).

## 3. Tech stack & kiến trúc

React + TypeScript cho UI, Dexie (IndexedDB) cho lưu trữ, engine mô phỏng viết bằng TypeScript thuần, không phụ thuộc React.

### 3.1 Stack

| Phần | Thư viện | Ghi chú |
| --- | --- | --- |
| Build | Vite + React 18 + TypeScript (strict) |  |
| Routing | React Router |  |
| State UI | Zustand + immer | Store riêng cho Editor, Matchup |
| Undo/redo | zundo (middleware Zustand) hoặc tự viết patch stack bằng immer | Tối thiểu 100 bước |
| Lưu trữ | Dexie.js + dexie-react-hooks (`useLiveQuery`) | IndexedDB |
| Vẽ | SVG thuần trong React, d3-shape cho đường cong | Không dùng canvas |
| Validate | Zod | Kiểm tra file import, migrate schema |
| ID | nanoid |  |
| Chạy nặng | Web Worker + Comlink | Chạy sim nhiều lần (Monte Carlo), Suggest |
| Export | html-to-image (PNG), jsPDF (PDF) |  |
| Style | Tailwind CSS |  |
| Test | Vitest, Testing Library, Playwright |  |

### 3.2 Cấu trúc thư mục

```
src/
  domain/          # types, hằng số, hình học, flip, đánh số receiver (TS thuần)
    types.ts
    field.ts       # cấu hình sân theo format
    geometry.ts    # vector, path length, nội suy, góc bẻ
    flip.ts
    numbering.ts   # strength, #1/#2/#3
    presets.ts     # bảng chỉ số Kém/TB/Hay
    routeTree.ts   # route mẫu
  engine/          # mô phỏng (TS thuần, deterministic)
    world.ts       # WorldState, history buffer
    perception.ts
    agents/        # receiver.ts, qb.ts, manDefender.ts, zoneDefender.ts, rusher.ts
    anticipation.ts# route prior, tín hiệu
    matchRules.ts
    ball.ts
    outcome.ts
    rng.ts         # seeded RNG
    simulate.ts    # simulate(matchup, options) => SimResult
  suggest/         # tag rules, chấm điểm, mismatch
  db/              # Dexie schema, migrations, repositories
  workers/         # sim.worker.ts
  store/           # Zustand stores
  features/
    editor/  matchup/  playbook/  install/  roster/  settings/
  components/
    field/         # FieldSvg, PlayerToken, RoutePath, ZoneShape, Timeline
  lib/             # export, import, utils
```

### 3.3 Quy tắc kiến trúc

- **NFR-ARC-01:** `domain/`, `engine/`, `suggest/` không import React, Dexie hay DOM. Chạy được trong Node và Web Worker.
- **NFR-ARC-02:** Engine là hàm thuần: cùng input + cùng seed thì ra cùng kết quả.
- **NFR-ARC-03:** UI không tự tính vị trí cầu thủ. UI chỉ vẽ frame do engine trả về.
- **NFR-ARC-04:** Component truy cập dữ liệu qua repository trong `db/`, không gọi Dexie trực tiếp.
- **NFR-ARC-05:** Tọa độ lưu bằng yard. Chỉ lớp vẽ SVG mới đổi sang pixel qua 1 hàm `toScreen()`.

## 4. Hệ tọa độ, sân và format

Mọi tọa độ trong play tính bằng yard, gốc là vị trí bóng trên LOS. Nhờ vậy play offense và defense ghép với nhau mà không cần quy đổi.

### 4.1 Quy ước tọa độ

- **x:** ngang sân. `x = 0` là bóng. Dương là bên phải, âm là bên trái, nhìn từ phía offense.
- **y:** dọc sân. `y = 0` là LOS. Dương là hướng tấn công (về phía defense). Offense bắt đầu ở `y ≤ 0`, defense ở `y ≥ 0`.
- **Đơn vị:** yard, số thực. Editor snap theo lưới 0.5 yd (tắt được bằng phím Alt).
- **Thời gian:** giây. `t = 0` là snap. Motion trước snap có `t < 0`.

### 4.2 Cấu hình sân theo format

```ts
interface FieldConfig {
  format: '5v5' | '7v7' | 'custom';
  playersPerSide: number;
  width: number;                 // yd
  length: number;                // yd giữa 2 goal line, không tính end zone
  endZoneDepth: number;          // yd
  lineToGain: number[];          // yd tính từ goal line nhà, ví dụ [25] = giữa sân
  noRunZones: { from: number; to: number }[];   // đoạn yd line chỉ được chuyền
  rushLine: number;              // yd từ LOS, rusher xuất phát từ vạch này trở ra
  maxRushers: number;            // số designated rusher tối đa
  rusherGoesOnSnap: boolean;     // rusher phải đi ngay khi snap
  qbCanCrossLOS: boolean;        // QB cầm bóng chạy qua LOS
  centerEligible: boolean;       // center được nhận bóng
  passClock: number;             // giây từ snap đến lúc bóng rời tay
  catchBeyondLOS: boolean;       // đường chuyền phải được bắt sau LOS
  contact: 'none';               // không block, không jam, không screen
}
```

| Thuộc tính | 5v5 (NFL FLAG, mặc định) | 7v7 / custom |
| --- | --- | --- |
| Số người mỗi bên | 5 | 7 / tùy |
| Kích thước sân | 30 × 70 yd (50 yd + 2 end zone 10 yd) | Copy từ 5v5, chỉnh theo luật giải |
| Line-to-gain | Giữa sân | nt |
| No-run zone | 5 yd trước mỗi goal line và 5 yd trước giữa sân | nt |
| Rush line | 7 yd tính từ LOS | nt |
| Rusher | Tối đa 2 designated rusher, giơ tay trước snap, nếu rush thì phải đi ngay khi snap | nt |
| QB | Không được cầm bóng chạy qua LOS. 7 giây để ra bóng | nt |
| Center | Được chạy route nhận bóng | nt |
| Chuyền | Chỉ chuyền tới, phải được bắt sau LOS (shovel pass hợp lệ nếu bắt sau LOS) | nt |
| Tiếp xúc | Không tackle, không block, không screen. Offense phải tránh đường rusher | nt |

Nguồn: [NFL FLAG — Flag Football Rules](https://nflflag.com/flag-football-rules). Trang này không nói luật motion/shift và luật riêng cho 7v7.

**Ảnh hưởng tới app:**

| Luật | Áp vào đâu |
| --- | --- |
| Rush line 7 yd, tối đa 2 rusher | Editor cảnh báo (FR-ED-07, FR-DEF-04) |
| Rusher đi ngay khi snap | `RushAction.delay` phải = 0, Editor cảnh báo nếu khác 0 |
| Chỉ designated rusher được qua LOS khi QB còn cầm bóng | Engine kẹp `y ≥ 0` cho defender khác (8.6) |
| Pass clock 7 giây | QB bắt buộc ra bóng, hết giờ là outcome `timeout` (8.5). Sim chạy tối đa 9 giây |
| Bắt bóng sau LOS | QB không ném cho receiver có điểm bắt dự đoán ở `y ≤ 0` (8.5) |
| Center được nhận bóng | Center được vẽ route và đánh số như receiver khác |
| QB không chạy qua LOS | QB agent không scramble qua LOS |
| No-run zone | Badge "Chỉ được chuyền" khi `ballSpot` nằm trong zone. MVP chỉ có pass play nên không chặn gì thêm |
| Không tiếp xúc | Không mô phỏng block, jam. Rút cờ QB = sack |

Mọi giá trị đều chỉnh được trong Settings, không hardcode. Mặc định lấy theo NFL FLAG 5v5.

### 4.3 Vị trí bóng trên sân

- Play không chứa vị trí bóng trên sân. Matchup có `ballSpot = { x, yardLine }`.
- `ballSpot.x` mặc định 0 (giữa sân). Khác 0 khi bóng đặt lệch (hash). Khoảng cách tới sideline tính từ giá trị này.
- `ballSpot.yardLine` dùng để biết end zone còn bao xa. Route vượt quá cuối end zone hoặc ra ngoài sideline thì bị cắt và cảnh báo.

### 4.4 Yêu cầu

- **FR-FLD-01:** Vẽ sân theo `FieldConfig`: sideline, LOS, vạch mỗi 5 yd, end zone, rush line, line-to-gain giữa sân, no-run zone (kèm badge "Chỉ được chuyền").
- **FR-FLD-02:** Hàm `toScreen(p, viewport)` và `toField(px, viewport)` đổi qua lại yard ↔ pixel, giữ đúng tỉ lệ.
- **FR-FLD-03:** Zoom (bánh xe chuột, pinch) và pan (kéo bằng Space + chuột). Có nút "vừa màn hình".
- **FR-FLD-04:** Mặc định hiển thị từ 10 yd sau LOS đến 25 yd trước LOS. Offense tấn công từ dưới lên trên.

## 5. Data model & IndexedDB schema

Play chỉ chứa chiến thuật. Chỉ số cầu thủ nằm ở Athlete/Lineup. Flip, lineup, anticipation nằm ở Matchup. Nhờ tách như vậy, 1 play dùng lại được trong nhiều matchup mà không phải sao chép.

### 5.1 Kiểu cơ bản

```ts
type ID = string;                       // nanoid
type Point = { x: number; y: number };  // yard
type Side = 'offense' | 'defense';
type Format = '5v5' | '7v7' | 'custom';
type Preset = 'weak' | 'avg' | 'good';  // Kém / TB / Hay
type OffenseRole = 'QB' | 'C' | 'WR' | 'RB' | 'TE';
type DefenseRole = 'CB' | 'S' | 'LB' | 'R';   // R = rusher
type Role = OffenseRole | DefenseRole;

// Tham chiếu receiver theo số, không theo vị trí trái/phải
type ReceiverRef =
  | { kind: 'number'; side: 'strong' | 'weak'; number: 1 | 2 | 3 }
  | { kind: 'role'; role: 'RB' | 'QB' | 'C' };
```

### 5.2 Play

```ts
interface Play {
  id: ID;
  schemaVersion: number;
  name: string;
  side: Side;
  format: Format;
  formation: string;                 // "Trips", "Cover 3" (không chứa Left/Right)
  strength: 'left' | 'right' | 'balanced';  // offense: tính tự động, cho phép ghi đè
  alignTo?: 'ball' | 'strength';     // defense: vẽ theo bóng hay theo phía mạnh offense
  players: PlayerSlot[];
  progression?: ID[];                // offense: thứ tự đọc của QB (slot id)
  tags: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

interface PlayerSlot {
  id: ID;                            // duy nhất trong play
  role: Role;
  label: string;                     // "X", "Z", "Y", "H", "C", "Q", "CB1", "FS"... dùng để khớp Lineup
  start: Point;
  leverage?: 'inside' | 'outside' | 'head-up';   // defense
  actions: Action[];                 // thực hiện theo thứ tự thời gian
  matchRules?: MatchRule[];          // defense
}
```

### 5.3 Action

```ts
type Action =
  | MotionAction | RouteAction | OptionRouteAction | QbDropAction   // offense
  | ManAction | ZoneAction | RushAction | SpyAction;               // defense

interface MotionAction { type: 'motion'; path: Point[]; duration: number }  // trước snap
interface RouteAction {
  type: 'route';
  path: Point[];                     // điểm bẻ, bắt đầu từ vị trí hiện tại
  smooth?: boolean[];                // mỗi điểm bẻ: gắt hay cong
  templateId?: string;               // "slant", "out"... nếu tạo từ route tree
  delay?: number;                    // giây chờ sau snap
  endBehavior: 'stop' | 'continue';  // hết path: đứng lại (hitch, curl) hay chạy tiếp
}
interface OptionRouteAction {
  type: 'option';
  stem: Point[];                     // đoạn chung
  vsMan: Point[];                    // nhánh khi đoán là man
  vsZone: Point[];                   // nhánh khi đoán là zone
  decideAtStemEnd: true;
}
interface QbDropAction { type: 'qbDrop'; depth: number; style: 'shotgun' | 'under' }

interface ManAction {
  type: 'man';
  target: ReceiverRef;
  technique: 'trail' | 'cushion';
  cushion?: number;                  // yd
}
interface ZoneAction {
  type: 'zone';
  zone: ZonePresetId | { polygon: Point[] };   // toạ độ so với bóng
  dropPoint: Point;
}
type ZonePresetId =
  | 'deep-half-L' | 'deep-half-R' | 'deep-third-L' | 'deep-third-M' | 'deep-third-R'
  | 'deep-middle' | 'flat-L' | 'flat-R' | 'hook-L' | 'hook-R' | 'hook-M' | 'curl-flat-L' | 'curl-flat-R';
interface RushAction { type: 'rush'; path: Point[]; delay?: number }   // NFL FLAG: delay = 0
interface SpyAction { type: 'spy'; target: { kind: 'role'; role: 'QB' } }
```

### 5.4 Luật pattern match (defense)

```ts
interface MatchRule {
  id: ID;
  priority: number;                  // nhỏ chạy trước
  when: {
    receiver: ReceiverRef;
    event: 'vertical' | 'out' | 'in' | 'under' | 'release' | 'stop';
    minDepth?: number;               // yd tính từ LOS
    beforeTime?: number;             // giây
  };
  then:
    | { type: 'man'; target: ReceiverRef }   // chuyển sang kèm người này
    | { type: 'zone'; zone: ZonePresetId }   // chuyển về zone khác
    | { type: 'carry' }                       // tiếp tục bám receiver đang trong zone
    | { type: 'passOff' };                    // thả receiver cho zone kế bên
}
```

### 5.5 Athlete, Lineup

```ts
interface Stats {
  speed: number;      // yd/s tối đa
  accel: number;      // giây từ 0 đến tốc độ tối đa
  cutLoss: number;    // 0..1, % tốc độ mất khi bẻ 180°
  reaction: number;   // giây trễ perception
  iq: number;         // 0..1, đọc route/zone, đọc tín hiệu
  hands: number;      // 0..1, xác suất chạm/bắt được bóng khi tới kịp
  ballSkills: number; // 0..1, xác suất phá được bóng (INT hoặc gạt) khi tới kịp
  release: number;    // QB: giây từ lúc quyết định đến lúc bóng rời tay
  accuracy: number;   // QB: 0..1
  armRange: number;   // QB: yd ném xa tối đa
  eyeDiscipline: number; // QB: 0..1, 0 = nhìn chằm chằm target
}

interface Athlete {
  id: ID; name: string; preset: Preset | 'custom';
  stats: Stats; positions: Role[]; notes?: string;
}

interface Lineup {
  id: ID; name: string; side: Side; format: Format;
  slots: { label: string; athleteId?: ID; preset?: Preset }[];   // khớp theo PlayerSlot.label
}
```

### 5.6 Matchup, Install, Settings

```ts
interface Matchup {
  id: ID; name?: string;
  offensePlayId: ID; offenseFlipped: boolean;
  defensePlayId: ID; defenseFlip: 'auto' | 'none' | 'flip';
  offenseLineupId?: ID; defenseLineupId?: ID;
  overrides: { side: Side; label: string; preset?: Preset; stats?: Partial<Stats> }[];
  anticipation: number;              // 0..1, mặc định 0.5
  ballSpot: { x: number; yardLine: number };
  seed: number;                      // cho RNG, để xem lại y hệt
  noise: boolean;                    // bật dao động ±10% chỉ số
  notes?: string;
  createdAt: number; updatedAt: number;
}

interface Install {
  id: ID; name: string; description?: string;
  items: { id: ID; matchupId: ID; order: number; coachNote?: string }[];
  createdAt: number; updatedAt: number;
}

interface Settings {
  key: 'app';
  fields: Record<Format, FieldConfig>;
  defaultFormat: Format;
  presets: Record<Preset, Stats>;    // bảng mặc định mục 7, chỉnh được
  tuning: TuningParams;              // mục 11
  routePriors: RoutePriorTable;      // mục 8
  ui: { theme: 'light' | 'dark' | 'system'; snap: boolean; showGrid: boolean };
}
```

### 5.7 Dexie schema

```ts
class FlagDB extends Dexie {
  plays!: Table<Play, ID>;
  athletes!: Table<Athlete, ID>;
  lineups!: Table<Lineup, ID>;
  matchups!: Table<Matchup, ID>;
  installs!: Table<Install, ID>;
  settings!: Table<Settings, string>;
  constructor() {
    super('flagbook');
    this.version(1).stores({
      plays:    'id, side, format, name, formation, *tags, updatedAt',
      athletes: 'id, name, preset',
      lineups:  'id, side, format, name',
      matchups: 'id, offensePlayId, defensePlayId, updatedAt',
      installs: 'id, name, updatedAt',
      settings: 'key',
    });
  }
}
```

### 5.8 Quy tắc dữ liệu

- **FR-DAT-01:** Mọi record có `schemaVersion`. Nâng schema bằng `db.version(n).upgrade()` và có test migrate.
- **FR-DAT-02:** Xóa play đang được matchup dùng: hiện danh sách matchup bị ảnh hưởng, cho chọn hủy hoặc xóa luôn các matchup đó (và gỡ khỏi Install).
- **FR-DAT-03:** Matchup trỏ tới play không còn tồn tại thì hiển thị trạng thái lỗi, không crash.
- **FR-DAT-04:** Ghi dữ liệu qua transaction. Lưu Editor theo kiểu auto-save, debounce 800 ms, có trạng thái "Đã lưu / Đang lưu".
- **FR-DAT-05:** Lần đầu mở app: seed Settings mặc định và một bộ play mẫu (3 offense, 3 defense cho 5v5).

## 6. Editor offense & defense, Flip

Editor vẽ 1 play trên sân SVG, lưu tự động vào IndexedDB. Flip trong Editor sửa chính play đó. Flip trong Matchup chỉ đổi cách hiển thị, không sửa play gốc.

Độ ưu tiên: **P0** = MVP bắt buộc, **P1** = nên có ngay sau MVP, **P2** = sau này.

### 6.1 Chung cho cả 2 bên

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-ED-01 | Tạo play mới: chọn side, format, bắt đầu trống hoặc từ formation mẫu | P0 |
| FR-ED-02 | Đặt và kéo cầu thủ. Số cầu thủ tối đa theo format. Tự gán label mặc định, sửa được | P0 |
| FR-ED-03 | Snap lưới 0.5 yd, giữ Alt để tắt snap | P0 |
| FR-ED-04 | Undo/redo tối thiểu 100 bước (Ctrl+Z, Ctrl+Shift+Z) | P0 |
| FR-ED-05 | Metadata: tên, formation, tag (autocomplete từ tag đã có), ghi chú | P0 |
| FR-ED-06 | Auto-save (FR-DAT-04). Nhân bản play (Duplicate) | P0 |
| FR-ED-07 | Panel cảnh báo: thiếu/thừa người, route ra ngoài sân, sai phía LOS, rusher đứng trong rush line (< 7 yd), quá 2 rusher, rush có delay > 0, route có điểm bắt ở sau LOS, man target không tồn tại. Chỉ cảnh báo, không chặn lưu | P0 |
| FR-ED-08 | Chọn nhiều cầu thủ, copy/paste, xóa | P1 |
| FR-ED-09 | Export play ra PNG | P1 |

### 6.2 Offense

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-OFF-01 | Vẽ route: tool Route, click từng điểm bẻ, Enter hoặc double-click để kết thúc, Shift khóa góc 45°, Esc hủy | P0 |
| FR-OFF-02 | Sửa route: kéo điểm, chèn điểm trên đoạn, xóa điểm, chuyển gắt/cong từng điểm | P0 |
| FR-OFF-03 | Route tree: chọn receiver → chọn route mẫu (hitch, slant, out, in, go, post, corner, curl, comeback, flat, drag, wheel, whip, out-and-up, sluggo) + độ sâu. Mẫu định nghĩa theo hướng "vào trong / ra ngoài" nên tự đúng hướng theo phía receiver đứng | P0 |
| FR-OFF-04 | QB: độ sâu drop, kiểu shotgun/under. Thứ tự đọc (progression): click lần lượt các receiver, hiện badge 1, 2, 3 | P0 |
| FR-OFF-05 | Strength tự tính: đếm receiver đủ điều kiện mỗi bên bóng (bỏ QB, bỏ người đứng tại x = 0). Bằng nhau thì `balanced`. Cho phép ghi đè | P0 |
| FR-OFF-06 | Nút "Chạy thử": animation riêng play offense, không defense, để kiểm tra timing | P0 |
| FR-OFF-07 | Motion trước snap: path nét đứt, thời lượng; route bắt đầu từ điểm cuối motion | P1 |
| FR-OFF-08 | Option route: vẽ stem + 2 nhánh (vs man, vs zone) | P1 |
| FR-OFF-09 | Route delay (giây chờ sau snap) | P1 |

### 6.3 Defense

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-DEF-01 | **Ghost offense:** khi vẽ defense, hiện 1 formation offense tham chiếu mờ để gán kèm người. Chọn được formation (mặc định theo format). Lưu `Play.strength` = strength của ghost lúc thiết kế | P0 |
| FR-DEF-02 | Man: tool Man, click defender rồi click receiver ghost. Lưu dạng `ReceiverRef` (ví dụ strong #1), không lưu id. Chọn technique trail/cushion | P0 |
| FR-DEF-03 | Zone: chọn zone mẫu hoặc vẽ polygon. Kéo drop point. Zone hiển thị màu trong suốt | P0 |
| FR-DEF-04 | Rush: đánh dấu designated rusher (tối đa 2, giơ tay trên token), tự tạo path từ rusher tới QB, sửa được. Cảnh báo nếu vượt `maxRushers` | P0 |
| FR-DEF-05 | Leverage inside/outside/head-up cho mỗi defender. Nút "Tự căn" đặt defender theo receiver mục tiêu + leverage + cushion | P0 |
| FR-DEF-06 | `alignTo`: vẽ theo bóng hoặc theo strength (ảnh hưởng defenseFlip auto) | P0 |
| FR-DEF-07 | Luật pattern match: danh sách luật mỗi defender, form "Khi \[receiver\] \[sự kiện\] \[sâu ≥ n yd\] thì \[phản ứng\]", kéo thả để đổi priority | P1 |
| FR-DEF-08 | Spy QB | P2 |

### 6.4 Flip

```ts
function flipPlay(play: Play): Play;  // hàm thuần trong domain/flip.ts
```

| Đối tượng | Khi lật |
| --- | --- |
| `start`, mọi `path`, `polygon`, `dropPoint`, `stem`, `vsMan`, `vsZone` | x → −x |
| `strength` | left ↔ right, balanced giữ nguyên |
| Zone mẫu | `-L` ↔ `-R`, `-M` giữ nguyên |
| `leverage`, `ReceiverRef`, `label`, `templateId` | Giữ nguyên (đã là tương đối) |
| `ballSpot.x` (ở Matchup) | Giữ nguyên. Play lật, vị trí bóng trên sân thì không |

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-FLP-01 | `flipPlay` theo bảng trên. `flipPlay(flipPlay(p))` bằng `p` | P0 |
| FR-FLP-02 | Nút Flip trong Editor (phím F) sửa chính play, có undo | P0 |
| FR-FLP-03 | Matchup có `offenseFlipped` và `defenseFlip`. Không tạo bản sao play | P0 |
| FR-FLP-04 | `defenseFlip = 'auto'`: nếu defense `alignTo = 'strength'` và strength lúc thiết kế khác strength thực tế của offense (sau flip) thì lật defense | P0 |
| FR-FLP-05 | Playbook hiển thị thumbnail cả 2 chiều khi bật "xem bản lật" | P2 |

## 7. Athlete, preset Kém/TB/Hay, Lineup

Mỗi vị trí trong matchup có bộ chỉ số lấy từ preset, Athlete hoặc chỉnh tay. Play không chứa chỉ số.

### 7.1 Bảng preset mặc định

| Chỉ số | Áp dụng | Kém | TB | Hay | Dùng từ |
| --- | --- | --- | --- | --- | --- |
| `speed` (yd/s) | Tất cả | 6 | 7 | 8 | P0 |
| `accel` (s đến tốc độ tối đa) | Tất cả | 1.2 | 0.9 | 0.6 | P0 |
| `cutLoss` (% tốc mất khi bẻ 180°) | Receiver, defender | 0.5 | 0.35 | 0.2 | P0 |
| `reaction` (s) | Defense, QB | 0.5 | 0.35 | 0.2 | P0 |
| `iq` (0..1) | Defense: đọc route/zone. QB: tốc độ đọc progression | 0.3 | 0.5 | 0.8 | P1 |
| `release` (s, từ lúc chọn target đến lúc bóng rời tay) | QB | 0.6 | 0.45 | 0.3 | P0 |
| `accuracy` (0..1) | QB | 0.6 | 0.75 | 0.9 | P1 |
| `armRange` (yd) | QB | 20 | 30 | 40 | P1 |
| `eyeDiscipline` (0..1) | QB | 0.2 | 0.5 | 0.85 | P1 |
| `hands` (0..1) | Receiver | 0.6 | 0.75 | 0.9 | P1 |
| `ballSkills` (0..1) | Defender | 0.2 | 0.35 | 0.55 | P1 |

Các số trên là điểm khởi đầu, chỉnh được trong Settings để khớp trình độ team thật.

Thời gian QB đọc mỗi bước progression: `readTime = 0.8 − 0.5 × iq` giây (Kém 0.65 s, TB 0.55 s, Hay 0.4 s).

### 7.2 Thứ tự lấy chỉ số cho 1 vị trí trong matchup

1. `Matchup.overrides[].stats` (chỉnh tay từng chỉ số)
2. `Matchup.overrides[].preset`
3. Lineup → slot có cùng `label` → `athleteId` → `Athlete.stats`
4. Lineup → slot cùng `label` → `preset`
5. `Settings.presets.avg`

Bật `Matchup.noise` thì mỗi lần chạy nhân mỗi chỉ số với hệ số ngẫu nhiên trong \[0.9, 1.1\], dùng seeded RNG.

```ts
function resolveStats(m: Matchup, side: Side, label: string, ctx: DbSnapshot): Stats;
```

### 7.3 Yêu cầu

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-ATH-01 | Trong Matchup, click cầu thủ → panel bên phải có 3 nút Kém / TB / Hay, lưu vào `overrides` | P0 |
| FR-ATH-02 | Viền màu token theo trình độ: đỏ = Kém, xám = TB, xanh = Hay, tím = custom | P0 |
| FR-ATH-03 | "Nâng cao": slider cho từng chỉ số, nút "Về preset" | P1 |
| FR-ATH-04 | Màn Roster: CRUD Athlete (tên, vị trí sở trường, preset hoặc chỉ số) | P1 |
| FR-ATH-05 | Màn Lineup: tạo lineup theo side + format, gán Athlete hoặc preset vào từng label | P1 |
| FR-ATH-06 | Matchup chọn lineup cho mỗi bên. Không chọn thì mọi người là TB | P1 |
| FR-ATH-07 | So sánh 2 lineup: cùng matchup, chạy 2 lần, hiện kết quả cạnh nhau | P2 |

## 8. Engine mô phỏng

Engine chạy từng bước 1/60 giây. Mỗi cầu thủ chỉ được đọc **perception** (những gì thấy được, trễ theo `reaction`), không bao giờ đọc play của bên kia. Defense không bị động nhờ leverage, route prior, tín hiệu, luật match và áp lực thời gian.

### 8.1 API

```ts
interface SimInput {
  offense: Play; defense: Play;        // đã áp flip
  offenseStats: Record<ID, Stats>;     // theo slot id
  defenseStats: Record<ID, Stats>;
  field: FieldConfig; ballSpot: { x: number; yardLine: number };
  anticipation: number; seed: number; noise: boolean;
  tuning: TuningParams; routePriors: RoutePriorTable;
}

interface SimResult {
  frames: Frame[];          // lấy mẫu 30 fps để phát lại
  events: SimEvent[];       // snap, break, ruleFired, throw, catch, deflect, int, sack...
  outcome: Outcome;
  metrics: SimMetrics;
  warnings: string[];
}

interface Frame { t: number; players: Record<ID, { pos: Point; vel: Point; state: string }>; ball: BallState }

type Outcome =
  | { kind: 'complete'; targetId: ID; yards: number; t: number }
  | { kind: 'incomplete' | 'deflected' | 'intercepted'; targetId: ID; t: number }
  | { kind: 'sack' | 'throwaway' | 'timeout'; t: number };

interface SimMetrics {
  separation: Record<ID, { t: number; d: number }[]>;  // mỗi receiver theo thời gian
  separationAtThrow?: Record<ID, number>;
  timeToThrow?: number;
  openWindows: Record<ID, [number, number][]>;          // khoảng thời gian receiver mở ≥ ngưỡng
}

function simulate(input: SimInput): SimResult;
function simulateMany(input: SimInput, runs: number): AggregateResult;  // chạy trong Worker
```

### 8.2 Chuẩn bị trước snap

1. Áp flip cho offense. Tính strength thực tế. Nếu `defenseFlip = 'auto'` thì xét lật defense (FR-FLP-04).
2. **Đánh số receiver:** với mỗi phía bóng, sắp xếp receiver đủ điều kiện theo |x| giảm dần, gán #1, #2, #3. RB đứng trong backfield (|x| < 3 và y < −2) không đánh số, tham chiếu bằng role RB.
3. Map mỗi `ReceiverRef` của defense sang slot id thật. Không tìm thấy (ví dụ strong #3 không tồn tại) thì defender chuyển sang zone hook cùng phía và ghi warning.
4. Resolve chỉ số (mục 7.2), áp noise.
5. Chạy motion (t < 0). Defense thấy motion và đánh số lại receiver tại snap (P1).

### 8.3 Perception (chống nhìn trước)

```ts
interface Perception {
  t: number;
  others: { id: ID; side: Side; role: Role; number?: ReceiverRef; pos: Point; vel: Point }[];  // tại t − reaction
  ball: { state: 'held' | 'inAir' | 'dead'; pos: Point; landing?: Point };
  qb: { pos: Point; eyeTarget?: ID; throwStarted: boolean };
}

interface Agent {
  step(self: AgentState, p: Perception, dt: number, rng: Rng): Intent;  // Intent = hướng + tốc độ mong muốn
}
```

- World giữ **history buffer** các trạng thái đã qua. Perception của mỗi agent được nội suy tại `t − reaction`.
- Agent chỉ nhận: trạng thái của chính mình, assignment của mình, chỉ số của mình, perception, thông tin sân.
- Agent **không được** nhận: Play của đối phương, path tương lai, matchRules hay tên coverage của đối phương. Ràng buộc bằng type, không truyền `world` vào agent.
- Ngoại lệ duy nhất: `anticipation > 0.5` bật **oracle** (8.7), được cô lập trong `anticipation.ts` và đánh dấu rõ trên UI.

### 8.4 Mô hình di chuyển

- Vận tốc tiến dần tới hướng mong muốn. Gia tốc tối đa = `speed / accel`. Tốc độ không vượt `speed`.
- Khi đổi hướng một góc θ độ: `v = v × (1 − cutLoss × θ / 180)`, sau đó tăng tốc lại.
- Không va chạm. Hai cầu thủ cách nhau dưới 0.5 yd thì đẩy nhẹ ra để không chồng hình.
- Cầu thủ không được ra ngoài sideline (kẹp vị trí).

### 8.5 Offense

**Receiver**

- Đi theo path. Trước điểm bẻ gắt, giảm tốc trong `cutLoss × tellWindow` giây (đây là tín hiệu defense đọc được).
- Hết path: theo `endBehavior` của route, `stop` (hitch, curl, comeback) thì đứng lại, `continue` thì chạy tiếp hướng cuối đến sideline hoặc cuối end zone.
- Option route: cuối stem, đoán man nếu defender gần nhất cách ≤ 2 yd và hướng chạy tương quan ≥ 0.7 trong 0.8 s trước đó. Ngược lại là zone.

**QB**

- Lùi về độ sâu drop. Đọc progression theo thứ tự, mỗi bước tốn `readTime`.
- Target hiện tại được ném nếu: separation dự đoán tại lúc bóng tới ≥ `throwOpenThreshold` (mặc định 1.5 yd) và khoảng cách ≤ `armRange`.
- Bị ép (rusher cách ≤ 2 yd) hoặc hết `passClock`: ném cho receiver mở nhất, không ai mở thì ném bỏ. Rusher tới ≤ 1 yd trước khi bóng rời tay thì là sack.
- `eyeTarget` = target đang đọc. Với xác suất `eyeDiscipline`, QB nhìn lừa sang hướng khác (look-off).
- Ra quyết định xong, bóng rời tay sau `release` giây. Defense thấy `throwStarted` ngay khi bắt đầu động tác ném.

**Luật NFL FLAG cho offense:**

- Hết `passClock` (7 giây) mà bóng chưa rời tay: outcome `timeout`.
- QB không cầm bóng chạy qua LOS.
- QB chỉ ném cho receiver có điểm bắt dự đoán ở phía trước LOS (y > 0).
- Center là receiver đủ điều kiện, được đánh số như receiver khác.

### 8.6 Defense

**Man**

- Nhắm vào vị trí dự đoán của target (8.7), lệch 1 yd về phía leverage.
- `trail`: bám sau-trong. `cushion`: giữ khoảng cách `cushion` yd cho tới khi receiver áp sát, sau đó quay người chạy theo.
- Receiver bẻ về phía leverage: `reaction` hiệu dụng = `reaction × leverageReactionFactor` (mặc định 0.3).

**Zone**

- Pha 1: chạy về `dropPoint`.
- Pha 2: trong các receiver đã thấy ở trong zone (cộng vùng đệm 2 yd), chọn người nguy hiểm nhất: zone sâu chọn người sâu nhất, zone nông chọn người gần nhất. Giữ vị trí giữa receiver và QB, không rời zone quá vùng đệm.
- Receiver ra khỏi zone thì thả, trừ khi luật match bảo `carry`.
- Trôi về phía `eyeTarget` của QB theo hệ số `iq × eyeDriftFactor`.

**Rush:** chờ `delay`, chạy theo path rồi đuổi vị trí QB đang thấy.

**Luật NFL FLAG cho defense:**

- Tối đa 2 designated rusher, xuất phát cách LOS ≥ 7 yd. Nếu rush thì đi ngay khi snap, không có delay.
- Defender không phải rusher không được qua LOS khi QB còn cầm bóng. Engine kẹp `y ≥ 0` cho các defender này đến khi bóng rời tay.
- Không tiếp xúc. Rusher tới gần QB trong `sackRadius` là rút cờ (sack).

**Luật match:** mỗi tick kiểm tra sự kiện từ perception. Định nghĩa sự kiện:

| Sự kiện | Điều kiện (trên perception) |
| --- | --- |
| `release` | Receiver rời LOS, y > 0.5 |
| `vertical` | Vận tốc dọc chiếm ≥ 70% và độ sâu ≥ `minDepth` |
| `out` | Vận tốc ngang hướng ra sideline chiếm ≥ 60% |
| `in` | Vận tốc ngang hướng vào bóng chiếm ≥ 60%, độ sâu > 6 yd |
| `under` | Cắt ngang vào trong, độ sâu ≤ 6 yd |
| `stop` | Tốc độ < 1 yd/s |

Luật khớp đầu tiên theo `priority` được áp dụng, ghi event `ruleFired`. Defender iq thấp nhận ra sự kiện trễ thêm `(1 − iq) × 0.3` giây.

**Khi bóng được ném:** defender thấy `throwStarted` (sau reaction) thì chuyển sang lao về điểm bóng rơi.

### 8.7 Anticipation (defense đoán trước)

Mức `a` lấy từ Matchup, mặc định 0.5.

```ts
reactiveAim = seen.pos + seen.vel * lookahead;                      // chỉ phản ứng
priorAim    = Σ P(route | quan sát) * template(route).posAt(t + lookahead);  // đoán theo xác suất
oracleAim   = target.truePosAt(t + lookahead);                       // biết trước (stress test)

if (a <= 0.5) aim = lerp(reactiveAim, priorAim, (a / 0.5) * iq);
else          aim = lerp(lerp(reactiveAim, priorAim, iq), oracleAim, (a - 0.5) / 0.5);
```

| Thành phần | Bật khi | Mô tả |
| --- | --- | --- |
| Leverage | Luôn bật | Mục 8.6 |
| Route prior | a > 0 | Bảng xác suất route theo đặc điểm đứng (số receiver, khoảng cách tới sideline). Cập nhật theo Bayes khi receiver chạy: route không khớp quỹ đạo thì xác suất giảm |
| Tín hiệu giảm tốc | a > 0 | Thấy receiver giảm tốc trước điểm bẻ: với xác suất `iq`, reaction cho lần bẻ đó giảm 50% |
| Mắt QB | a > 0 | Zone defender trôi về `eyeTarget` |
| Oracle | a > 0.5 | Trộn dần vị trí thật trong tương lai. a = 1 là defense đọc hoàn hảo |

```ts
type RoutePriorTable = Record<string /* ví dụ 'n1-wide', 'n1-tight', 'n2-slot' */, Record<string /* templateId */, number>>;
```

### 8.8 Bóng và kết quả

- Bóng bay với tốc độ `ballSpeed` (mặc định 18 yd/s). Điểm nhắm = vị trí dự đoán của receiver khi bóng tới.
- Sai số ném: phân phối chuẩn, độ lệch = `(1 − accuracy) × inaccuracyK × khoảng cách`.
- Khi bóng tới điểm rơi, xét receiver trong `catchRadius` (1 yd) và defender trong `contestRadius` (1 yd).
- MVP kết thúc pha ở thời điểm bắt bóng. `yards` = độ sâu điểm bắt so với LOS. Chạy sau khi bắt (YAC) là P2.

| Receiver tới kịp | Defender tới kịp | Kết quả |
| --- | --- | --- |
| Không | Không | Incomplete |
| Có | Không | Complete với xác suất `hands`, còn lại rơi bóng (incomplete) |
| Không | Có | Defender phá được bóng với xác suất `ballSkills`. Không phá được thì incomplete |
| Có | Có | Tranh chấp: mỗi bên tự tranh bóng độc lập (code bên dưới) |

**Tranh chấp:** `hands` và `ballSkills` không trừ nhau trực tiếp. Mỗi bên tung xúc xắc riêng, chỉ khi cả hai cùng chạm được bóng mới chia theo vị trí.

```ts
function resolveContest(hands: number, ballSkills: number, recDist: number, defDist: number,
                        t: TuningParams, rng: Rng): 'complete' | 'intercepted' | 'deflected' | 'incomplete' {
  const recOk = rng() < hands;        // receiver chạm được bóng
  const defOk = rng() < ballSkills;   // defender chạm được bóng
  if (!recOk && !defOk) return 'incomplete';
  if (recOk && !defOk) return 'complete';
  if (recOk && defOk) {
    // cả hai cùng chạm: ai gần điểm bóng rơi hơn thì phần lớn hơn
    const k = t.contestShareExponent;
    const sum = recDist ** k + defDist ** k;
    const recShare = sum === 0 ? 0.5 : defDist ** k / sum;
    if (rng() < recShare) return 'complete';
  }
  // defender thắng: chia INT / gạt rơi
  return rng() < t.intShare ? 'intercepted' : 'deflected';
}
```

Ví dụ `hands = 0.8`, `ballSkills = 0.75`, `intShare = 1` (defender thắng là INT):

| Trường hợp | Xác suất |
| --- | --- |
| Chỉ receiver chạm | 0.8 × 0.25 = 0.20 |
| Chỉ defender chạm | 0.75 × 0.2 = 0.15 |
| Cả hai cùng chạm | 0.8 × 0.75 = 0.60 |
| Không ai chạm | 0.2 × 0.25 = 0.05 |

| Vị trí khi cả hai cùng chạm | Complete | INT | Incomplete |
| --- | --- | --- | --- |
| Ngang nhau (recShare 0.5) | 50% | 45% | 5% |
| Receiver gần hơn (recShare 0.7) | 62% | 33% | 5% |
| Defender gần hơn (recShare 0.3) | 38% | 57% | 5% |

`hands` và `ballSkills` chỉ dùng khi đã tới kịp điểm bóng rơi. Tỉ lệ INT trên tổng số đường chuyền vẫn thấp, vì phần lớn pha không có defender nào tới kịp.

**Kiểm tra:** unit test chạy `resolveContest` 100.000 lần với các số trên, kết quả lệch không quá ±1 điểm phần trăm so với bảng.

### 8.9 Yêu cầu

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-ENG-01 | `simulate()` theo API 8.1, bước cố định 1/60 s, tối đa 9 s (pass clock 7 s + bóng bay) | P0 |
| FR-ENG-02 | Đánh số receiver, bind ReceiverRef, fallback khi thiếu target | P0 |
| FR-ENG-03 | Perception trễ theo reaction, history buffer, agent không truy cập world | P0 |
| FR-ENG-04 | Di chuyển theo speed, accel, cutLoss | P0 |
| FR-ENG-05 | Receiver theo path, endBehavior. Man, zone, rush cơ bản. Leverage | P0 |
| FR-ENG-06 | QB progression, ném, bóng bay, outcome cơ bản (hands, sack) | P0 |
| FR-ENG-07 | Metrics separation, openWindows, timeToThrow | P0 |
| FR-ENG-08 | Route prior, tín hiệu giảm tốc, mắt QB, thanh anticipation, oracle | P1 |
| FR-ENG-09 | Luật match, option route, motion | P1 |
| FR-ENG-10 | Accuracy, armRange, ballSkills, deflect/int | P1 |
| FR-ENG-11 | `simulateMany` trong Web Worker, trả về % thành công, phân bố target, separation trung bình | P1 |
| FR-ENG-12 | YAC sau khi bắt bóng | P2 |

## 9. Matchup, Playbook, Install

Matchup là nơi xem offense vs defense chạy animation. Mọi thay đổi tham số (flip, lineup, anticipation, seed) chạy lại sim ngay và giữ nguyên vị trí playhead.

### 9.1 Matchup

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-MU-01 | Tạo matchup: chọn 1 play offense + 1 play defense cùng format. Khác format thì không cho chọn | P0 |
| FR-MU-02 | Điều khiển: flip offense, defenseFlip (auto/none/flip), vị trí bóng (x, yard line), seed (nút xúc xắc để đổi), bật/tắt noise | P0 |
| FR-MU-03 | Phát lại: play/pause (Space), kéo timeline, tốc độ 0.25x / 0.5x / 1x / 2x, nhảy tới event kế (→) hoặc trước (←) | P0 |
| FR-MU-04 | Timeline có mốc event: snap, break, ruleFired, throw, catch, sack | P0 |
| FR-MU-05 | Overlay bật/tắt: route dự kiến, vệt chạy thật, zone, đường man (defender → target), đường bóng bay | P0 |
| FR-MU-06 | Separation: số yard cạnh mỗi receiver, màu đỏ < 1 yd, vàng 1–2.5 yd, xanh > 2.5 yd | P0 |
| FR-MU-07 | Panel kết quả: outcome, target, yards, time to throw, separation lúc ném của từng receiver, thanh open window theo thời gian | P0 |
| FR-MU-08 | Lưu matchup, đặt tên, ghi chú | P0 |
| FR-MU-09 | Chỉnh nhanh Kém/TB/Hay từng cầu thủ (FR-ATH-01), chọn lineup (FR-ATH-06) | P0 / P1 |
| FR-MU-10 | Thanh anticipation 0 → 1, có mốc 0 / 0.5 / 1. Trên 0.5 hiện nhãn "Oracle: defense biết trước" | P1 |
| FR-MU-11 | Overlay debug perception: chọn 1 defender, hiện bóng mờ vị trí receiver mà defender đang "thấy" (trễ), và điểm đang nhắm | P1 |
| FR-MU-12 | Overlay mắt QB (đường nhìn tới eyeTarget) | P1 |
| FR-MU-13 | Chạy 50 lần (Worker): % complete, phân bố target, yards trung bình, % sack, % int | P1 |
| FR-MU-14 | Nút "Sửa play" mở Editor, quay lại thì matchup cập nhật theo | P1 |

### 9.2 Playbook

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-PB-01 | Danh sách play dạng lưới, thumbnail SVG (vị trí đứng + route/assignment) | P0 |
| FR-PB-02 | Lọc theo side, format, formation, tag. Tìm theo tên. Sắp xếp theo ngày sửa hoặc tên | P0 |
| FR-PB-03 | Thao tác: mở, nhân bản, xóa (FR-DAT-02), tạo matchup từ play này | P0 |
| FR-PB-04 | Danh sách matchup: thumbnail đôi, lọc theo play offense/defense | P0 |
| FR-PB-05 | Hiển thị số matchup đang dùng mỗi play | P1 |
| FR-PB-06 | Chọn nhiều play để export JSON | P1 |

### 9.3 Install

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-IN-01 | Tạo Install: tên, mô tả | P0 |
| FR-IN-02 | Thêm matchup (từ picker hoặc nút "Thêm vào Install" trong Matchup), kéo thả để đổi thứ tự, xóa item | P0 |
| FR-IN-03 | Ghi chú coach cho từng item (text, hỗ trợ xuống dòng và gạch đầu dòng) | P0 |
| FR-IN-04 | Chế độ trình chiếu: fullscreen, từng item, tự phát animation, ← → để chuyển, N để ẩn/hiện ghi chú, L để lặp | P0 |
| FR-IN-05 | Theme sân tương phản cao cho máy chiếu | P1 |
| FR-IN-06 | Export Install ra PDF: mỗi item 1 trang (sơ đồ trước snap + route + ghi chú) | P1 |

## 10. Suggest & Random defense

Suggest xếp hạng play trong playbook theo 3 tầng: tag, kết quả mô phỏng, mismatch chỉ số. Mỗi gợi ý kèm lý do cụ thể bằng số.

### 10.1 Hai hướng gợi ý

| Hướng | Input | Output |
| --- | --- | --- |
| Offense đánh coverage | 1 play defense (+ lineup tùy chọn) | Top 5 play offense cùng format |
| Defense chặn play | 1 play offense (+ lineup tùy chọn) | Top 5 play defense cùng format |

### 10.2 Quy ước tag

- Defense: `cov:cover-0`, `cov:cover-1`, `cov:cover-2`, `cov:cover-3`, `cov:man`, `cov:zone`, `blitz`.
- Offense: `beats:cover-2`, `beats:man`..., cùng các tag concept tự do (`concept:flood`, `quick`).
- Editor gợi ý các tag này khi gõ.

### 10.3 Cách chấm điểm

```ts
score = wTag * tagMatch            // 0 hoặc 1
      + wSim * simScore            // 0..1, chuẩn hóa
      + wMis * mismatchScore;      // 0..1

// Offense: simScore từ simulateMany(N = 30)
simScore = 0.5 * pComplete + 0.3 * norm(avgYards) - 0.1 * pSack - 0.1 * pInt;
// Defense: đảo dấu (1 − điểm offense)
```

- **Mismatch:** với lineup đang chọn, tìm cặp receiver và defender kèm người có chênh lệch `speed` hoặc `cutLoss` lớn. Cộng điểm cho play đặt receiver đó ở progression #1 hoặc đứng một mình một bên. Rusher nhanh vs QB `release` chậm thì cộng điểm play có tag `quick`.
- Trọng số `wTag`, `wSim`, `wMis` nằm trong `TuningParams`.

### 10.4 Yêu cầu

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-SG-01 | Suggest theo tag (tầng 1), chạy tức thì | P1 |
| FR-SG-02 | Suggest theo sim (tầng 2), chạy trong Worker, có thanh tiến độ và nút hủy | P1 |
| FR-SG-03 | Mỗi gợi ý hiện điểm + lý do, ví dụ: "Slant mở trung bình 2.3 yd lúc ném, hoàn thành 74%" | P1 |
| FR-SG-04 | Nút "Tạo matchup" từ mỗi gợi ý | P1 |
| FR-SG-05 | Mismatch theo lineup (tầng 3) | P2 |
| FR-SG-06 | Cache kết quả theo hash (play A, play B, lineup, tuning) trong bộ nhớ phiên | P1 |

### 10.5 Random defense

Chế độ tự luyện đọc coverage, chạy hoàn toàn local.

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-RD-01 | Trong Matchup, chọn offense, bấm "Random defense": bốc ngẫu nhiên 1 play defense cùng format (lọc được theo tag) | P1 |
| FR-RD-02 | Khi đang ẩn: giấu tên play defense, ẩn overlay zone và đường man, chỉ thấy cầu thủ di chuyển | P1 |
| FR-RD-03 | Trước khi lộ, cho đoán coverage từ danh sách `cov:*`. Bấm "Hiện" hoặc hết animation thì lộ tên + overlay, báo đúng/sai | P1 |
| FR-RD-04 | Đếm số lần đoán đúng trong phiên | P2 |

## 11. Lưu trữ, import/export, tuning

IndexedDB là nơi lưu duy nhất, nên export JSON là cách backup bắt buộc. Mọi hệ số engine nằm trong `TuningParams`, chỉnh trên UI, không sửa code.

### 11.1 Export / import

```ts
interface ExportFile {
  app: 'flagbook';
  schemaVersion: number;
  exportedAt: string;          // ISO
  data: {
    plays?: Play[]; athletes?: Athlete[]; lineups?: Lineup[];
    matchups?: Matchup[]; installs?: Install[]; settings?: Settings;
  };
}
```

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-IO-01 | Export toàn bộ dữ liệu ra 1 file JSON | P0 |
| FR-IO-02 | Import: validate bằng Zod, migrate nếu `schemaVersion` cũ, báo cáo số record thêm/cập nhật/bỏ qua | P0 |
| FR-IO-03 | Chế độ import: Gộp (trùng id thì giữ bản có `updatedAt` mới hơn, hoặc tạo bản sao id mới) hoặc Thay thế toàn bộ (hỏi xác nhận) | P0 |
| FR-IO-04 | Gọi `navigator.storage.persist()` lần đầu mở app để trình duyệt không tự xóa dữ liệu | P0 |
| FR-IO-05 | Banner nhắc backup nếu lần export gần nhất cách đây > 14 ngày | P1 |
| FR-IO-06 | Export chọn lọc (một số play, 1 install kèm các play/matchup nó cần) | P1 |
| FR-IO-07 | Export PNG (play, frame hiện tại của matchup), PDF (install) | P1 |
| FR-IO-08 | Export animation ra GIF hoặc video | P2 |

### 11.2 TuningParams

| Tham số | Mặc định | Đơn vị | Dùng ở |
| --- | --- | --- | --- |
| `simDt` | 1/60 | s | 8.1 |
| `maxTime` | 9 | s | 8.1 |
| `lookahead` | 0.3 | s | 8.7 |
| `tellWindow` | 0.25 | s | 8.5 |
| `leverageOffset` | 1 | yd | 8.6 |
| `leverageReactionFactor` | 0.3 | hệ số | 8.6 |
| `zoneBuffer` | 2 | yd | 8.6 |
| `eyeDriftFactor` | 0.3 | hệ số | 8.6 |
| `throwOpenThreshold` | 1.5 | yd | 8.5 |
| `pressureRadius` | 2 | yd | 8.5 |
| `sackRadius` | 1 | yd | 8.5 |
| `ballSpeed` | 18 | yd/s | 8.8 |
| `inaccuracyK` | 0.05 | hệ số | 8.8 |
| `catchRadius` | 1 | yd | 8.8 |
| `contestRadius` | 1 | yd | 8.8 |
| `intShare` | 0.4 | hệ số | 8.8 |
| `contestShareExponent` | 1 | số mũ | 8.8 |
| `separationTight` / `separationOpen` | 1 / 2.5 | yd | FR-MU-06 |
| `wTag` / `wSim` / `wMis` | 0.2 / 0.7 / 0.1 | trọng số | 10.3 |
| `suggestRuns` | 30 | lần | 10.3 |

### 11.3 Màn Tuning

| Mã | Yêu cầu | Ưu tiên |
| --- | --- | --- |
| FR-TUN-01 | Slider cho từng tham số, nút "Về mặc định" | P1 |
| FR-TUN-02 | Chỉnh bảng preset Kém/TB/Hay và cấu hình sân | P1 |
| FR-TUN-03 | Benchmark: chạy bộ matchup mẫu (play seed), mọi người TB, hiện % complete từng cặp. Mục tiêu: concept tốt vs coverage phù hợp đạt 60–70% | P1 |
| FR-TUN-04 | Chỉnh bảng route prior | P2 |

## 12. Màn hình UI & phím tắt

App có 8 màn hình. Sân luôn nằm giữa, panel thuộc tính bên phải, điều khiển phát lại ở dưới.

### 12.1 Route và màn hình

| Route | Màn hình | Nội dung chính |
| --- | --- | --- |
| `/` | Playbook | Lưới play + tab Matchup, bộ lọc, nút tạo mới |
| `/play/new`, `/play/:id` | Editor | Toolbar trái, sân giữa, panel phải, thanh trên (tên, side, format, trạng thái lưu, Flip, Chạy thử, undo/redo), panel cảnh báo dưới |
| `/matchup/new`, `/matchup/:id` | Matchup | Sân giữa, timeline + nút phát dưới, panel phải (tham số, kết quả, cầu thủ đang chọn), menu overlay |
| `/install`, `/install/:id` | Install | Danh sách item kéo thả, ghi chú, nút Trình chiếu |
| `/install/:id/present` | Trình chiếu | Fullscreen, 1 item mỗi lần |
| `/roster` | Roster | Tab Athlete + tab Lineup |
| `/suggest` | Suggest | Chọn hướng, chọn play, danh sách gợi ý |
| `/settings` | Settings | Sân, preset, tuning, benchmark, import/export, theme |

### 12.2 Hiển thị trên sân

| Đối tượng | Cách vẽ |
| --- | --- |
| Cầu thủ offense | Hình tròn, chữ label ở giữa |
| Cầu thủ defense | Hình tam giác hoặc chữ X, label bên cạnh |
| Route | Nét liền có mũi tên. Route chính (progression #1) đậm hơn |
| Motion | Nét đứt zigzag |
| Option route | Stem liền, 2 nhánh đứt, ghi "M" / "Z" |
| Zone | Vùng màu trong suốt, mỗi loại zone một màu |
| Man | Đường đứt mảnh từ defender tới receiver |
| Rush | Mũi tên đậm hướng về QB |
| Leverage | Chấm nhỏ lệch về phía inside/outside |
| Trình độ | Viền token: đỏ / xám / xanh / tím |
| Separation | Số yard cạnh receiver, màu theo ngưỡng |

### 12.3 Phím tắt

| Phím | Màn | Tác dụng |
| --- | --- | --- |
| V | Editor | Tool chọn |
| P | Editor | Đặt cầu thủ |
| R | Editor | Vẽ route |
| M / Z / B | Editor | Gán man / zone / rush |
| F | Editor | Flip play |
| Enter / Esc | Editor | Kết thúc / hủy thao tác vẽ |
| Shift | Editor | Khóa góc 45° |
| Alt | Editor | Tắt snap |
| Delete | Editor | Xóa đối tượng đang chọn |
| Ctrl+Z / Ctrl+Shift+Z | Editor | Undo / redo |
| Ctrl+D | Editor | Nhân bản cầu thủ đang chọn |
| Space + kéo | Editor | Pan sân |
| Space | Matchup, Trình chiếu | Play / pause |
| ← / → | Matchup | Event trước / kế |
| ← / → | Trình chiếu | Item trước / kế |
| \[ / \] | Matchup | Giảm / tăng tốc độ phát |
| 1 / 2 / 3 | Matchup | Đặt cầu thủ đang chọn thành Kém / TB / Hay |
| N / L | Trình chiếu | Ẩn hiện ghi chú / lặp |
| ? | Mọi màn | Bảng phím tắt |

## 13. Yêu cầu phi chức năng

Ngưỡng quan trọng nhất: 1 lần sim 5v5 dưới 20 ms, để mọi thay đổi tham số trong Matchup thấy kết quả ngay.

| Mã | Nhóm | Yêu cầu |
| --- | --- | --- |
| NFR-PERF-01 | Hiệu năng | Kéo cầu thủ, điểm route trong Editor mượt 60 fps |
| NFR-PERF-02 | Hiệu năng | 1 lần `simulate()` 6 s: 5v5 < 20 ms, 7v7 < 40 ms trên laptop tầm trung |
| NFR-PERF-03 | Hiệu năng | `simulateMany` 50 lần < 1.5 s, chạy trong Worker, UI không bị đứng |
| NFR-PERF-04 | Hiệu năng | Playbook 500 play: lọc/tìm < 100 ms. App mở lần đầu < 2 s |
| NFR-REL-01 | Độ tin cậy | Đóng tab khi đang sửa không mất dữ liệu: flush auto-save khi `visibilitychange` / `pagehide` |
| NFR-REL-02 | Độ tin cậy | Lỗi IndexedDB (hết quota, bị chặn) hiện thông báo rõ + gợi ý export |
| NFR-REL-03 | Độ tin cậy | Engine deterministic: cùng input + seed thì frames giống hệt |
| NFR-REL-04 | Độ tin cậy | Error boundary mỗi màn hình. Play hỏng dữ liệu không làm sập cả app |
| NFR-UX-01 | Khả dụng | Editor hỗ trợ màn hình ≥ 1024 px. Matchup và Trình chiếu xem được trên tablet ≥ 768 px, cảm ứng |
| NFR-UX-02 | Khả dụng | Theme sáng / tối / theo hệ thống |
| NFR-UX-03 | Khả dụng | Thao tác chính làm được bằng bàn phím (mục 12.3). Focus hiển thị rõ, nút toolbar có aria-label |
| NFR-UX-04 | Ngôn ngữ | UI tiếng Việt, giữ thuật ngữ football tiếng Anh. Toàn bộ chuỗi đặt trong 1 file để sau này thêm tiếng Anh |
| NFR-OFF-01 | Offline | Chạy offline hoàn toàn sau lần tải đầu. PWA cài được (P1) |
| NFR-PRV-01 | Riêng tư | Không gửi dữ liệu ra ngoài, không analytics |
| NFR-CODE-01 | Chất lượng code | TypeScript strict, ESLint, Prettier. Coverage `domain/` + `engine/` ≥ 80% |
| NFR-CODE-02 | Chất lượng code | Quy tắc kiến trúc NFR-ARC-01 đến 05 (mục 3.3), kiểm tra bằng eslint `no-restricted-imports` |

## 14. Test & acceptance criteria

Hai nhóm test quan trọng nhất là flip (đúng người sau khi lật) và chống nhìn trước trong engine. Nếu 2 nhóm này sai thì mọi animation đều vô nghĩa.

### 14.1 Unit test `domain/` (Vitest)

| Mã | Test |
| --- | --- |
| T-DOM-01 | `flipPlay(flipPlay(p))` bằng `p` với mọi play mẫu (property test với fast-check) |
| T-DOM-02 | Lật offense: mọi defender man vẫn bám đúng slot receiver trước khi lật |
| T-DOM-03 | Lật cả 2 bên: assignment không đổi |
| T-DOM-04 | Strength: Trips, 2x2 (balanced), Bunch, Stack, có RB backfield |
| T-DOM-05 | Đánh số #1/#2/#3 đúng cho các formation trên, RB không được đánh số |
| T-DOM-06 | Route mẫu: slant của receiver bên trái đi vào trong (x tăng), sau khi lật vẫn đi vào trong (x giảm) |
| T-DOM-07 | `toField(toScreen(p))` bằng `p` (sai số < 0.01 yd) |
| T-DOM-08 | `resolveStats` đúng thứ tự ưu tiên mục 7.2 |

### 14.2 Unit test `engine/`

| Mã | Test |
| --- | --- |
| T-ENG-01 | Deterministic: chạy 2 lần cùng input + seed, frames giống hệt |
| T-ENG-02 | **Không nhìn trước:** với anticipation ≤ 0.5, sửa phần route sau thời điểm t0 thì vị trí mọi defender trước t0 + reaction nhỏ nhất không đổi |
| T-ENG-03 | Oracle: với anticipation = 1, test T-ENG-02 cho kết quả khác (oracle thật sự đọc tương lai) |
| T-ENG-04 | Option route chọn nhánh khác nhau khi ghép với defense man và defense zone |
| T-ENG-05 | Leverage: slant vs CB inside leverage có separation lúc bẻ nhỏ hơn slant vs CB outside leverage |
| T-ENG-06 | WR Hay vs CB TB có separation trung bình lớn hơn WR Kém vs cùng CB (30 lần, noise bật) |
| T-ENG-07 | Anticipation 0 → 0.5 → 1: separation trung bình giảm dần |
| T-ENG-08 | Rusher Hay + không receiver nào mở: outcome là sack hoặc throwaway |
| T-ENG-09 | Luật match: receiver đi vertical sâu ≥ minDepth thì có event `ruleFired` và defender đổi assignment |
| T-ENG-10 | ReceiverRef thiếu target: defender chuyển zone, có warning, không crash |
| T-ENG-11 | Hiệu năng: benchmark NFR-PERF-02 chạy trong CI, fail nếu vượt ngưỡng 2 lần |

### 14.3 Test `db/` (Vitest + fake-indexeddb)

- CRUD từng bảng. Query theo tag (multiEntry index).
- Migrate từ version cũ lên mới giữ nguyên dữ liệu.
- Xóa play đang dùng: cascade đúng (FR-DAT-02).
- Import gộp / thay thế đúng. File sai schema bị từ chối, không ghi gì.

### 14.4 E2E (Playwright)

1. Tạo play offense 5v5, vẽ 3 route, đóng tab, mở lại: dữ liệu còn nguyên.
2. Tạo play defense Cover 1 với ghost offense, gán man, lưu.
3. Tạo matchup từ 2 play trên, phát animation đến hết, thấy outcome.
4. Bật flip offense: defense tự lật (auto), man vẫn đúng người.
5. Đổi CB1 sang Kém: separation receiver đối diện tăng.
6. Tạo Install 3 item, trình chiếu, chuyển item bằng phím mũi tên.
7. Export JSON, xóa dữ liệu, import lại: mọi thứ khôi phục.

### 14.5 Definition of Done cho MVP

- [ ] Mọi yêu cầu P0 đã làm và có test tương ứng.
- [ ] T-DOM-01 đến 08, T-ENG-01, 02, 05, 06, 08, 10 pass.
- [ ] 7 kịch bản E2E pass trên Chrome và Safari.
- [ ] Benchmark: mọi người TB, concept tốt vs coverage phù hợp đạt 60–70% complete.
- [ ] Bộ play mẫu (3 offense, 3 defense) ghép chéo 9 matchup, xem bằng mắt thấy hợp lý.

## 15. Roadmap & thứ tự triển khai

Làm theo thứ tự Editor → Engine → Playbook. Engine (phase 3) là rủi ro lớn nhất nên nên prototype logic sim bằng unit test trước khi làm UI Matchup.

| Phase | Tên | Ước lượng | Nội dung | Yêu cầu |
| --- | --- | --- | --- | --- |
| 0 | Nền tảng | 2–3 ngày | Setup Vite + TS, domain types, vẽ sân, Dexie schema, seed data | FR-FLD-01..04, FR-DAT-01..05, NFR-ARC-01..05 |
| 1 | Editor offense | 1–1.5 tuần | Đặt cầu thủ, vẽ route, route tree, QB progression, Flip | FR-ED-01..07, FR-OFF-01..06, FR-FLP-01..02 |
| 2 | Editor defense | 1 tuần | Ghost offense, man / zone / rush, leverage, alignTo | FR-DEF-01..06 |
| 3 | Engine + Matchup | 1.5–2 tuần | Perception, di chuyển, man/zone/rush, QB, bóng, metrics, playback | FR-ENG-01..07, FR-MU-01..09, FR-FLP-03..04, FR-ATH-01..02 |
| 4 | Playbook + Install | 1 tuần | Playbook, Install, trình chiếu, export / import JSON | FR-PB-01..04, FR-IN-01..04, FR-IO-01..04 |
| — | **MVP gate** | | Đạt Definition of Done (mục 14.5), mọi yêu cầu P0 xong | |
| 5 | Engine nâng cao | 1.5 tuần | Anticipation, route prior, luật match, option, motion, Worker | FR-ENG-08..11, FR-MU-10..14, FR-OFF-07..09, FR-DEF-07, FR-TUN-01..03 |
| 6 | Suggest + Roster | 1 tuần | Suggest tag + sim, Random defense, Roster, Lineup, slider | FR-SG-01..04, FR-SG-06, FR-RD-01..03, FR-ATH-03..06, FR-IO-05..07 |
| 7 | Sau này | khi cần | Mismatch, YAC, PWA, export GIF, so sánh lineup, sync cloud | Các yêu cầu P2 |

Mỗi phase kết thúc khi các FR liệt kê đã làm và test liên quan ở mục 14 pass. Backend và sync cloud chỉ cân nhắc ở phase 7, khi cần xem trên nhiều thiết bị.

## 16. Câu hỏi mở

Cần chốt trước phase 0. Chưa chốt thì dùng giá trị mặc định đã ghi trong tài liệu.

- [x] Luật giải: dùng NFL FLAG, đã cập nhật mục 4.2.
- [x] Center có được nhận bóng không: có, theo NFL FLAG.
- [ ] Format chính: mặc định 5v5 theo NFL FLAG, seed play mẫu cho 5v5. Nếu dùng 7v7 thì cần luật giải riêng, vì trang NFL FLAG không ghi.
- [ ] Luật motion/shift: trang NFL FLAG không ghi. Tạm cho phép 1 người motion trước snap.
- [ ] Bộ play mẫu: lấy play thật của team hay play phổ biến (Cover 1, Cover 2, Cover 3; Trips flood, Mesh, Smash)?
- [ ] Run play ở bản sau: NFL FLAG cho handoff/pitch sau LOS, sau đó mọi defender được rush. Có cần không?
- [ ] Trên tablet chỉ xem, hay cần sửa play bằng cảm ứng?

## Nguồn

- [NFL FLAG — Flag Football Rules](https://nflflag.com/flag-football-rules)
