<template>
  <button class="quick-find-trigger" :disabled="disabled" @click="open"><el-icon><Search /></el-icon><span>搜索资料或功能</span><kbd>Ctrl K</kbd></button>
  <el-dialog v-model="visible" title="快速查找" width="min(620px, 94vw)" class="quick-find-dialog" :show-close="true" @opened="searchInput?.focus()">
    <el-input ref="searchInput" v-model="query" :prefix-icon="Search" clearable placeholder="输入资料名称、分类或功能名称" aria-label="快速查找资料或功能" @keydown.down.prevent="focusFirst" />
    <div class="quick-find-results" @keydown="moveFocus">
      <section v-if="matchedRoutes.length"><h3>功能</h3><button v-for="item in matchedRoutes" :key="item.id" @click="chooseRoute(item.id)"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span><small>前往</small><el-icon><ArrowRight /></el-icon></button></section>
      <section v-if="matchedFiles.length"><h3>资料 <span>{{ query ? '匹配结果' : '最近归档' }}</span></h3><button v-for="file in matchedFiles" :key="file.id" @click="chooseFile(file)"><el-icon><Document /></el-icon><span><strong>{{ file.name }}</strong><small>{{ file.category }} · {{ statusText[file.status] }}</small></span><el-icon><ArrowRight /></el-icon></button></section>
      <p v-if="!matchedRoutes.length && !matchedFiles.length" class="quick-find-empty">没有找到相关资料或功能</p>
    </div>
    <template #footer><span class="quick-find-help">↑ ↓ 选择 · Enter 打开 · Esc 关闭</span><span class="quick-find-help">只搜索当前浏览器的归档</span></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import { Search, ArrowRight, Document } from '@element-plus/icons-vue';
import { statusText, type Archive } from '../data';
const props = defineProps<{ files: Archive[]; navigation: { id: string; label: string; icon: Component }[]; active: boolean; disabled: boolean }>();
const emit = defineEmits<{ (e: 'navigate', id: string): void; (e: 'detail', file: Archive): void }>();
const visible = ref(false), query = ref(''), searchInput = ref<{ focus(): void }>();
const normalized = computed(() => query.value.trim().toLocaleLowerCase());
const matchedRoutes = computed(() => props.navigation.filter(item => !normalized.value || item.label.toLocaleLowerCase().includes(normalized.value)));
const matchedFiles = computed(() => props.files.filter(file => !normalized.value || [file.name, file.category, file.remark].join(' ').toLocaleLowerCase().includes(normalized.value)).slice(0, normalized.value ? 8 : 4));
function open() { if (!props.disabled) { query.value = ''; visible.value = true; } }
function chooseRoute(id: string) { visible.value = false; emit('navigate', id); }
function chooseFile(file: Archive) { visible.value = false; emit('detail', file); }
function focusFirst() { document.querySelector<HTMLButtonElement>('.quick-find-results button')?.focus(); }
function moveFocus(event: KeyboardEvent) {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  if (event.key === 'ArrowUp' && index === 0) { searchInput.value?.focus(); return; }
  buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
}
function shortcut(event: KeyboardEvent) {
  if (props.active && !props.disabled && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.altKey) { event.preventDefault(); open(); }
}
onMounted(() => window.addEventListener('keydown', shortcut));
onBeforeUnmount(() => window.removeEventListener('keydown', shortcut));
</script>
