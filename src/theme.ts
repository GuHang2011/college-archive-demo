export const themes = [
  { id: 'silver', name: '极简白', color: '#294f83', pale: '#dbe7f8', rail: '#25333f', canvas: '#ffffff', workspace: '#eaf0f7', surface: '#edf3fc', border: '#c5d1e0' },
  { id: 'bamboo', name: '青竹绿', color: '#086c55', pale: '#d3eee2', rail: '#113e38', canvas: '#f5f6f2', workspace: '#e8f2ee', surface: '#e6f2ed', border: '#b9d6c9' },
  { id: 'blue', name: '学院蓝', color: '#1f4fca', pale: '#dbe5ff', rail: '#173755', canvas: '#f3f5f9', workspace: '#e8eefb', surface: '#e8efff', border: '#bfd0ee' },
  { id: 'sand', name: '暖砂金', color: '#8a5614', pale: '#f2e2be', rail: '#443a29', canvas: '#f8f5ee', workspace: '#f3eddf', surface: '#f9efda', border: '#dccba9' },
  { id: 'rose', name: '海棠红', color: '#a82f4c', pale: '#f4dbe3', rail: '#4d2b37', canvas: '#faf4f5', workspace: '#f6eaf0', surface: '#fbeaf0', border: '#dec0ca' },
];
const KEY = 'college-demo-theme';
export function loadTheme() {
  try { return themes.find(t => t.id === localStorage.getItem(KEY)) || themes[0]; } catch { return themes[0]; }
}
export function applyTheme(theme: typeof themes[number]) {
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries({ '--accent': theme.color, '--accent-pale': theme.pale, '--rail': theme.rail, '--canvas': theme.canvas, '--theme-canvas': theme.workspace, '--theme-surface': theme.surface, '--theme-border': theme.border, '--el-color-primary': theme.color })) style.setProperty(key, value);
  const rgb = theme.color.slice(1).match(/../g)!.map(v => parseInt(v, 16));
  for (let i = 1; i <= 9; i++) style.setProperty(`--el-color-primary-light-${i}`, `rgb(${rgb.map(v => Math.round(v + (255 - v) * i / 10)).join(',')})`);
  style.setProperty('--el-color-primary-dark-2', `rgb(${rgb.map(v => Math.round(v * .8)).join(',')})`);
  try { localStorage.setItem(KEY, theme.id); } catch { /* Theme still works for this visit. */ }
}
