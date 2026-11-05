<template>
  <el-popover trigger="click" :width="280" placement="bottom-end"><template #reference><el-button aria-label="字体与阅读设置">Aa 字体</el-button></template><div class="reading-settings"><strong>字体与阅读</strong><p>字号大小</p><div><button v-for="item in sizes" :key="item.id" :aria-pressed="size === item.id" @click="size = item.id; apply()">{{ item.name }}</button></div><p>字体风格</p><div><button :aria-pressed="font === 'sans'" @click="font = 'sans'; apply()">清晰黑体</button><button :aria-pressed="font === 'serif'" @click="font = 'serif'; apply()">阅读宋体</button></div><small>选择自动保存在当前浏览器。</small></div></el-popover>
</template>
<script setup lang="ts">
import { ref } from 'vue';
const sizes = [{ id: 'standard', name: '标准', scale: '1' }, { id: 'comfortable', name: '舒适', scale: '1.12' }, { id: 'large', name: '大字', scale: '1.24' }];
const size = ref('standard'), font = ref('sans');
try { const saved = JSON.parse(localStorage.getItem('college-reading') || '{}'); if (sizes.some(item => item.id === saved.size)) size.value = saved.size; if (['sans', 'serif'].includes(saved.font)) font.value = saved.font; } catch { /* Default remains usable when storage is unavailable. */ }
function apply() { document.documentElement.style.setProperty('--reader-scale', sizes.find(item => item.id === size.value)!.scale); document.documentElement.style.setProperty('--reader-font', font.value === 'sans' ? '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' : '"Songti SC", "SimSun", serif'); try { localStorage.setItem('college-reading', JSON.stringify({ size: size.value, font: font.value })); } catch { /* Current session still works. */ } }
apply();
</script>
<style>
.reading-settings strong { font-size:15px; color:var(--ink); }.reading-settings p { font-size:12px; margin:18px 0 10px; color:var(--muted); }.reading-settings > div { display:flex; gap:8px; }.reading-settings button { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:5px; padding:9px 12px; font-size:12px; }.reading-settings button[aria-pressed=true] { color:var(--accent); border-color:var(--accent); background:var(--accent-pale); }.reading-settings small { display:block; margin-top:16px; color:var(--muted); font-size:11px; }
</style>
