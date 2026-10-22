// 本地模式（PWA）的默认数据，结构对齐服务端 normalizeDb
export const CLIENT_SCHEMA_VERSION = 1;

function defaultSlots() {
  const table = [
    ['08:00', '08:45'], ['08:55', '09:40'],
    ['10:00', '10:45'], ['10:55', '11:40'],
    ['14:00', '14:45'], ['14:55', '15:40'],
    ['16:00', '16:45'], ['16:55', '17:40'],
    ['19:00', '19:45'], ['19:55', '20:40'],
    ['20:50', '21:35'], ['21:45', '22:30']
  ];
  return table.map(([start, end], index) => ({ index: index + 1, start, end }));
}

export function defaultFitnessPlan() {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, title: '休息', rest: true, items: [] }));
}

export function defaultData() {
  return {
    version: CLIENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    data: {
      courses: [],
      todos: [],
      assignments: [],
      fitness: { plan: defaultFitnessPlan(), logs: [], weights: [] },
      budget: { accounts: [], months: {}, expenses: [] },
      fun: { plan: [], records: [], wishlist: [], games: [] },
      notes: { text: '', updatedAt: null },
      settings: {
        theme: 'auto',
        weekStart: 1,
        semesterStart: null,
        slots: defaultSlots(),
        backgroundImage: null,
        backgroundDim: 35,
        backgroundBlur: 0
      },
      trash: [],
      scheduleChanges: [],
      meta: { lastExportAt: null }
    }
  };
}
