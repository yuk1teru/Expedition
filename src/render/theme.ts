// Shared UI colours and fonts.

export const THEME = {
  bg: '#12151d',
  letterbox: '#07080b',
  panel: 'rgba(22, 26, 36, 0.94)',
  panelBorder: '#3a4258',
  text: '#e8ecf4',
  textDim: '#9aa3b8',
  textMuted: '#646d82',
  accent: '#f2c14e',
  good: '#6fd16f',
  bad: '#e5534b',
  xp: '#5aa9f2',
  hp: '#d64545',
  hpBack: '#3a1c1c',
  button: '#2a3145',
  buttonHover: '#3a4462',
  buttonDisabled: '#20242f',
  focus: '#f2c14e',
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

export function font(size: number, weight: 'normal' | 'bold' = 'normal'): string {
  return `${weight} ${size}px ${THEME.font}`;
}
