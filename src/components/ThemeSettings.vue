<template>
  <el-popover trigger="click" :width="324" placement="bottom-end" popper-class="theme-popover">
    <template #reference><el-button :icon="Brush" aria-label="切换界面主题">换肤</el-button></template>
    <div class="theme-settings">
      <div class="theme-heading">界面配色<small>当前：{{ selectedTheme.name }} · 点击即可预览</small></div>
      <div class="theme-options" role="group" aria-label="选择界面配色">
        <button v-for="theme in themes" :key="theme.id" :aria-label="theme.name" :aria-pressed="selectedTheme.id === theme.id" :style="{ '--preview-accent': theme.color, '--preview-pale': theme.pale, '--preview-canvas': theme.workspace, '--preview-border': theme.border }" @click="selectTheme(theme)">
          <span class="theme-preview" aria-hidden="true"><span class="theme-preview-nav"><i></i><i></i><i></i></span><span class="theme-preview-main"><i></i><i></i><i></i><b></b></span></span>
          <span class="theme-option-label"><i aria-hidden="true"></i>{{ theme.name }}<span v-if="selectedTheme.id === theme.id" class="theme-selected" aria-hidden="true">✓</span></span>
        </button>
      </div>
      <p class="theme-note">同时调整导航、按钮与工作区底色。选择会自动保存。</p>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Brush } from '@element-plus/icons-vue';
import { applyTheme, loadTheme, themes } from '../theme';
const selectedTheme = ref(loadTheme());
function selectTheme(theme: typeof themes[number]) { selectedTheme.value = theme; applyTheme(theme); }
applyTheme(selectedTheme.value);
</script>

<style>
.theme-popover.el-popover.el-popper { max-width:calc(100vw - 24px); padding:18px; border-color:#b6c5d8; }
.theme-settings { color:#18283c; }
.theme-settings .theme-heading { font-size:calc(16px * var(--reader-scale)); margin-bottom:16px; color:#18283c; }
.theme-settings .theme-heading small { font-size:calc(13px * var(--reader-scale)); color:#526176; }
.theme-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.theme-options > button { display:block; min-width:0; padding:5px; border:1px solid #c3cdd9; border-radius:7px; background:#fff; color:#24354b; text-align:left; }
.theme-options > button:hover { border-color:var(--preview-accent); }
.theme-options > button[aria-pressed='true'] { border-color:var(--preview-accent); box-shadow:0 0 0 1px var(--preview-accent); background:var(--preview-pale); }
.theme-options > button:focus-visible { outline:3px solid var(--preview-accent); outline-offset:3px; }
.theme-preview { display:grid; grid-template-columns:30px 1fr; height:60px; border:1px solid var(--preview-border); border-radius:3px; overflow:hidden; background:var(--preview-canvas); }
.theme-preview-nav { display:grid; align-content:start; gap:5px; padding:9px 4px; background:#fff; border-right:1px solid var(--preview-border); }
.theme-preview-nav i { height:4px; border-radius:1px; background:var(--preview-border); }
.theme-preview-nav i:first-child { height:8px; background:var(--preview-accent); }
.theme-preview-main { display:grid; grid-template-columns:1fr 1fr; align-content:start; gap:5px; padding:9px 7px; }
.theme-preview-main i { height:5px; grid-column:1 / -1; background:#fff; }
.theme-preview-main i:first-child { background:var(--preview-border); }
.theme-preview-main b { grid-column:2; height:9px; border-radius:2px; background:var(--preview-accent); }
.theme-option-label { display:flex; gap:6px; align-items:center; padding:8px 3px 3px; font-size:calc(14px * var(--reader-scale)); }
.theme-option-label > i { width:9px; height:9px; border-radius:50%; flex-shrink:0; background:var(--preview-accent); }
.theme-selected { margin-left:auto; font-size:14px; color:var(--preview-accent); font-weight:700; }
.theme-note { margin:16px 0 0; padding-top:12px; border-top:1px solid #d5dde7; color:#526176; font-size:calc(13px * var(--reader-scale)); line-height:1.7; }
</style>
