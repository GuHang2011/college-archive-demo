export const themes = [
  { id: 'bamboo', name: '青竹绿', color: '#177b66', pale: '#e7f2ed', rail: '#113e38', canvas: '#f5f6f2' },
  { id: 'blue', name: '学院蓝', color: '#2c62ad', pale: '#e7eef8', rail: '#173755', canvas: '#f3f5f9' },
  { id: 'sand', name: '暖砂金', color: '#936321', pale: '#f4ebd8', rail: '#443a29', canvas: '#f8f5ee' },
  { id: 'rose', name: '海棠红', color: '#a14659', pale: '#f6e7ec', rail: '#4d2b37', canvas: '#faf4f5' },
];
const KEY = 'college-demo-theme';
export function loadTheme() {
  try { return themes.find(t => t.id === localStorage.getItem(KEY)) || themes[0]; } catch { return themes[0]; }
}
export function applyTheme(theme: typeof themes[number]) {
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries({ '--accent': theme.color, '--accent-pale': theme.pale, '--rail': theme.rail, '--canvas': theme.canvas, '--el-color-primary': theme.color })) style.setProperty(key, value);
  const rgb = theme.color.slice(1).match(/../g)!.map(v => parseInt(v, 16));
  for (let i = 1; i <= 9; i++) style.setProperty(`--el-color-primary-light-${i}`, `rgb(${rgb.map(v => Math.round(v + (255 - v) * i / 10)).join(',')})`);
  style.setProperty('--el-color-primary-dark-2', `rgb(${rgb.map(v => Math.round(v * .8)).join(',')})`);
  try { localStorage.setItem(KEY, theme.id); } catch { /* Theme still works for this visit. */ }
}
