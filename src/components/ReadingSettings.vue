<template>
  <el-popover trigger="click" :width="320" placement="bottom-end" popper-class="reading-popover">
    <template #reference><el-button aria-label="字体与阅读设置">Aa 字体</el-button></template>
    <div class="reading-settings">
      <header><strong>字体与阅读</strong><button class="reading-reset" @click="reset">恢复默认</button></header>
      <p>字号大小</p>
      <div class="reading-options" role="group" aria-label="字号大小"><button v-for="item in sizes" :key="item.id" :aria-label="item.name" :aria-pressed="size === item.id" @click="size = item.id; apply()">{{ item.name }}<span>{{ item.pixels }}px</span></button></div>
      <p>字体风格</p>
      <div class="reading-options" role="group" aria-label="字体风格"><button :aria-pressed="font === 'sans'" @click="font = 'sans'; apply()">清晰黑体</button><button :aria-pressed="font === 'serif'" @click="font = 'serif'; apply()">阅读宋体</button></div>
      <div class="reading-preview" aria-label="字体效果预览"><strong>教学资料归档</strong><p>清晰阅读，更快找到需要的资料。</p><small>正文 {{ current.pixels }}px · 辅助文字 {{ Math.round(14 * current.pixels / 16 * 10) / 10 }}px</small></div>
      <small class="reading-note">全站即时生效，选择自动保存在当前浏览器。</small>
    </div>
  </el-popover>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
const sizes = [{ id: 'standard', name: '标准', pixels: 16 }, { id: 'comfortable', name: '舒适', pixels: 18 }, { id: 'large', name: '大字', pixels: 20 }];
const size = ref('standard'), font = ref('sans');
try { const saved = JSON.parse(localStorage.getItem('college-reading') || '{}'); if (sizes.some(item => item.id === saved.size)) size.value = saved.size; if (['sans', 'serif'].includes(saved.font)) font.value = saved.font; } catch { /* Default remains usable when storage is unavailable. */ }
const current = computed(() => sizes.find(item => item.id === size.value)!);
function apply() { document.documentElement.style.setProperty('--reader-scale', String(current.value.pixels / 16)); document.documentElement.style.setProperty('--reader-font', font.value === 'sans' ? '"PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif' : '"Songti SC", "SimSun", serif'); try { localStorage.setItem('college-reading', JSON.stringify({ size: size.value, font: font.value })); } catch { /* Current session still works. */ } }
function reset() { size.value = 'standard'; font.value = 'sans'; apply(); }
apply();
</script>
<style>
.reading-popover.el-popover.el-popper { max-width:calc(100vw - 24px); max-height:calc(100dvh - 32px); overflow-y:auto; padding:18px; }
.reading-settings header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.reading-settings header > strong { font-size:17px; color:var(--ink); }
.reading-settings > p { margin:18px 0 9px; font-size:14px; color:var(--muted); }
.reading-settings .reading-options { display:flex; gap:8px; }
.reading-options button { flex:1; min-width:0; border:1px solid #c3cdd9; background:#fff; color:var(--ink); border-radius:5px; padding:9px 5px; font-size:14px; line-height:1.5; }
.reading-options button > span { display:block; margin-top:3px; font-size:13px; }
.reading-options button[aria-pressed='true'] { color:var(--accent); border-color:var(--accent); background:var(--accent-pale); }
.reading-settings .reading-reset { border:0; background:none; color:var(--accent); padding:4px 0; font-size:13px; }
.reading-settings .reading-preview { display:block; margin-top:18px; padding:14px; background:var(--theme-surface); border:1px solid var(--theme-border); border-radius:6px; overflow-wrap:anywhere; }
.reading-settings .reading-preview strong { font-size:var(--text-section); font-weight:600; line-height:1.5; }
.reading-settings .reading-preview p { margin:6px 0 8px; font-size:var(--text-body); line-height:1.7; color:var(--ink); }
.reading-settings .reading-preview small { font-size:13px; color:var(--muted); }
.reading-settings .reading-note { display:block; margin-top:12px; font-size:13px; line-height:1.7; color:var(--muted); }
</style>
