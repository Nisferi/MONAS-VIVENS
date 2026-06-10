/**
 * ui/themes — три стиля мира: палитра поля + CSS-переменные интерфейса.
 * Палитра — единственный источник цветов для рендера и карточек летописи.
 */
export type Rgb = [number, number, number];

export interface Theme {
  id: 'clay' | 'papyrus' | 'obsidian';
  name: string;
  desc: string;
  /** Фон канваса за пределами поля. */
  canvasBg: string;
  /** Рамка края мира и линии сетки. */
  frame: string;
  grid: string;
  field: {
    empty: Rgb;
    ash: Rgb;
    signal: Rgb;
    spore: Rgb;
    crystal: Rgb;
    spring: Rgb;
    /** Палитры родов: молодое Семя → зрелое. */
    strains: { young: Rgb; old: Rgb }[];
  };
  /** Призраки будущего (линза Ⅲ): действующий закон и старый. */
  ghost: Rgb;
  ghostAlt: Rgb;
  /** CSS-переменные интерфейса. */
  css: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'clay',
    name: 'Глина и Золото',
    desc: 'ночная мастерская',
    canvasBg: '#0b0805',
    frame: 'rgba(217, 152, 64, 0.5)',
    grid: 'rgba(255, 217, 102, 0.10)',
    field: {
      empty: [0x12, 0x0d, 0x08],
      ash: [0x52, 0x3a, 0x24],
      signal: [0x00, 0xe5, 0xcf],
      spore: [0x6b, 0x7d, 0x4f],
      crystal: [0x7d, 0x86, 0xa8],
      spring: [0x0e, 0x4a, 0x42],
      strains: [
        { young: [0xff, 0x8c, 0x1a], old: [0xff, 0xd9, 0x66] }, // Огонь
        { young: [0x16, 0xa0, 0x6e], old: [0x7b, 0xed, 0xc8] }, // Нефрит
        { young: [0xa0, 0x5e, 0xea], old: [0xd9, 0xb8, 0xff] }, // Аметист
      ],
    },
    ghost: [0x00, 0xe5, 0xcf],
    ghostAlt: [0xc4, 0x7a, 0xff],
    css: {
      '--bg': '#0b0805',
      '--panel': 'rgba(20, 14, 8, 0.92)',
      '--line': 'rgba(217, 152, 64, 0.35)',
      '--gold': '#ffd966',
      '--ochre': '#d99840',
      '--turquoise': '#00e5cf',
      '--text': '#e8dcc8',
    },
  },
  {
    id: 'papyrus',
    name: 'Папирус',
    desc: 'дневной свиток, для солнца',
    canvasBg: '#e9ddc2',
    frame: 'rgba(122, 91, 46, 0.65)',
    grid: 'rgba(90, 64, 30, 0.14)',
    field: {
      empty: [0xde, 0xd0, 0xb0],
      ash: [0xb5, 0xa2, 0x80],
      signal: [0x0f, 0x6e, 0x75],
      spore: [0x7d, 0x8a, 0x5a],
      crystal: [0x8d, 0x96, 0xaa],
      spring: [0x3a, 0x86, 0x92],
      strains: [
        { young: [0xb3, 0x3a, 0x1e], old: [0xe2, 0x60, 0x2f] }, // киноварь
        { young: [0x1f, 0x4e, 0x8c], old: [0x3f, 0x74, 0xc0] }, // лазурит
        { young: [0x4a, 0x6b, 0x35], old: [0x6f, 0x94, 0x50] }, // зелёная земля
      ],
    },
    ghost: [0x0f, 0x6e, 0x75],
    ghostAlt: [0x7a, 0x3c, 0xa0],
    css: {
      '--bg': '#e9ddc2',
      '--panel': 'rgba(244, 234, 210, 0.94)',
      '--line': 'rgba(122, 91, 46, 0.5)',
      '--gold': '#8a5a13',
      '--ochre': '#7a5b2e',
      '--turquoise': '#0f6e75',
      '--text': '#3a2d1a',
    },
  },
  {
    id: 'obsidian',
    name: 'Обсидиан и Лёд',
    desc: 'полярная ночь',
    canvasBg: '#0a0e18',
    frame: 'rgba(143, 163, 200, 0.5)',
    grid: 'rgba(207, 226, 255, 0.10)',
    field: {
      empty: [0x10, 0x18, 0x2a],
      ash: [0x2e, 0x3a, 0x52],
      signal: [0xff, 0xd2, 0x7f],
      spore: [0x5a, 0x7d, 0x8a],
      crystal: [0xaa, 0xb6, 0xd4],
      spring: [0x11, 0x50, 0x5e],
      strains: [
        { young: [0x3f, 0xb9, 0xe8], old: [0xdc, 0xf4, 0xff] }, // лёд
        { young: [0x4f, 0x6d, 0xff], old: [0xa9, 0xb8, 0xff] }, // ультрамарин
        { young: [0xb0, 0x7f, 0xe8], old: [0xe3, 0xd2, 0xff] }, // сирень
      ],
    },
    ghost: [0x7f, 0xd8, 0xff],
    ghostAlt: [0xc4, 0x7a, 0xff],
    css: {
      '--bg': '#0a0e18',
      '--panel': 'rgba(14, 20, 34, 0.92)',
      '--line': 'rgba(143, 163, 200, 0.4)',
      '--gold': '#dce9ff',
      '--ochre': '#8fa3c8',
      '--turquoise': '#7fd8ff',
      '--text': '#d8e2f2',
    },
  },
];

export let activeTheme: Theme = THEMES[0] as Theme;

const THEME_KEY = 'monas.theme';

export function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? (THEMES[0] as Theme);
  activeTheme = theme;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.css)) {
    root.style.setProperty(k, v);
  }
  document.body.style.background = theme.canvasBg;
  try {
    localStorage.setItem(THEME_KEY, theme.id);
  } catch {
    /* ок */
  }
}

export function loadThemeId(): string {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'clay';
  } catch {
    return 'clay';
  }
}
