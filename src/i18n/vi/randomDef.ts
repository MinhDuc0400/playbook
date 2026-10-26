/** randomDef strings (NFR-UX-04). */
export const randomDef = {
  title: 'Random defense',
  random: 'Random defense',
  tagFilter: 'Lọc theo tag',
  tagAll: 'Tất cả',
  hiddenName: '???',
  guessPrompt: 'Đoán coverage',
  reveal: 'Hiện',
  correct: 'Đúng',
  wrong: 'Sai — đáp án',
  none: 'Không có play phòng thủ phù hợp',
  score: 'Điểm',
  defenseName: 'Play phòng thủ',
  tags: {
    'cov:cover-0': 'Cover 0',
    'cov:cover-1': 'Cover 1',
    'cov:cover-2': 'Cover 2',
    'cov:cover-3': 'Cover 3',
    'cov:man': 'Man',
    'cov:zone': 'Zone',
  } as Record<string, string>,
} as const;
