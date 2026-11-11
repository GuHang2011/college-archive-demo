<template>
  <div class="home-overview">
    <header class="home-heading">
      <div class="home-title"><h1>工作台</h1><p class="home-date">{{ today }}</p></div>
      <div class="home-actions"><el-button :icon="FolderOpened" @click="emit('navigate', 'archives')">浏览归档</el-button><el-button type="primary" :icon="Plus" :disabled="disabled" @click="emit('upload')">上传资料</el-button></div>
    </header>
    <dl class="home-summary" aria-label="归档概览">
      <div><dt>归档资料</dt><dd>{{ files.length }}<small>份</small></dd></div>
      <div class="summary-pending"><dt><i></i>待审核</dt><dd>{{ pending }}</dd></div>
      <div class="summary-approved"><dt><i></i>已通过</dt><dd>{{ approved }}</dd></div>
      <div class="summary-rejected"><dt><i></i>需修改</dt><dd>{{ files.filter(file => file.status === 'REJECTED').length }}</dd></div>
    </dl>
    <div class="home-columns">
      <section class="home-library" aria-labelledby="recent-title">
        <header class="home-section-heading"><h2 id="recent-title">最近归档</h2><button class="home-link" @click="emit('navigate', 'archives')">查看全部 <el-icon><ArrowRight /></el-icon></button></header>
        <div class="home-view-switch" role="group" aria-label="首页资料筛选"><button :aria-pressed="!pendingOnly" @click="pendingOnly = false">全部资料</button><button :aria-pressed="pendingOnly" @click="pendingOnly = true">待审核 <span>{{ pending }}</span></button></div>
        <div v-if="recent.length" class="recent-files">
          <button v-for="file in recent" :key="file.id" class="recent-file" :aria-label="`预览 ${file.name}`" @click="emit('preview', file)">
            <ArchiveThumbnail class="recent-file-icon" :data-category="file.category" :blob="file.blob" />
            <span class="recent-file-name"><strong :title="file.name">{{ file.name }}</strong><small><span>{{ file.category }}</span><span>{{ dateLabel(file.createdAt) }}</span><span class="recent-file-size">{{ fileSize(file.size) }}</span></small></span>
            <span class="recent-file-status" :class="file.status.toLowerCase()"><i></i>{{ statusText[file.status] }}</span><el-icon class="recent-file-arrow"><ArrowRight /></el-icon>
          </button>
        </div>
        <div v-else class="home-empty"><el-icon><FolderOpened /></el-icon><h3>{{ pendingOnly ? '暂无待审核资料' : '暂无归档资料' }}</h3><button v-if="!pendingOnly" class="home-link" :disabled="disabled" @click="emit('upload')">上传资料 <el-icon><ArrowRight /></el-icon></button></div>
        <p class="home-library-note">最近 {{ recent.length }} 份 · 点击文件预览</p>
      </section>
      <aside class="home-agenda">
        <section class="home-tasks" aria-labelledby="home-tasks-title">
          <header class="home-section-heading"><h2 id="home-tasks-title">待办任务 <span class="section-count">{{ upcoming.length }}</span></h2><button class="home-link" @click="emit('navigate', 'tasks')">全部任务 <el-icon><ArrowRight /></el-icon></button></header>
          <div class="home-task-list">
            <article v-for="task in upcoming" :key="task.id" class="home-task" :data-category="task.category">
              <div class="task-calendar" aria-hidden="true"><span>{{ monthLabel(task.deadline) }}</span><strong>{{ dayLabel(task.deadline) }}</strong></div>
              <div class="home-task-detail"><div class="home-task-category"><span>{{ task.category }}</span><span class="task-due" :class="{ soon: daysLeft(task.deadline) <= 3 }">{{ daysLeft(task.deadline) }} 天后截止</span></div><h3>{{ task.title }}</h3>
              <div class="home-task-bottom"><small>{{ dateLabel(task.deadline) }}</small><button class="home-link" :disabled="disabled" :aria-label="`提交资料：${task.title}`" @click="emit('upload', task.id)">提交 <el-icon><ArrowRight /></el-icon></button></div></div>
            </article>
            <p v-if="!upcoming.length" class="home-quiet">暂无待办任务</p>
          </div>
        </section>
        <div v-if="unreadChat || unreadBroadcast" class="home-unread" aria-label="未读消息">
          <button v-if="unreadChat" class="home-link" @click="emit('navigate', 'chat')">{{ unreadChat }} 条未读消息 <el-icon><ArrowRight /></el-icon></button>
          <button v-if="unreadBroadcast" class="home-link" @click="emit('navigate', 'broadcasts')">{{ unreadBroadcast }} 条未读广播 <el-icon><ArrowRight /></el-icon></button>
        </div>
        <details class="home-reference"><summary>摄影参考 <span>3 张素材</span><el-icon><ArrowRight /></el-icon></summary><PhotoGallery @preview="emit('photo', $event)" /></details>
      </aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRight, FolderOpened, Plus } from '@element-plus/icons-vue';
import { dateLabel, fileSize, statusText, type Archive } from '../data';
import ArchiveThumbnail from './ArchiveThumbnail.vue';
import PhotoGallery from './PhotoGallery.vue';
import type { Photo } from '../photos';
import '../home.css';
type Destination = 'archives' | 'tasks' | 'chat' | 'broadcasts' | 'assistant';
const props = defineProps<{ files: Archive[]; pending: number; approved: number; now: number; tasks: { id: number; title: string; category: string; deadline: number }[]; unreadChat: number; unreadBroadcast: number; disabled: boolean }>();
const emit = defineEmits<{ (e: 'upload', taskId?: number): void; (e: 'navigate', destination: Destination): void; (e: 'preview', file: Archive): void; (e: 'photo', photo: Photo): void }>();
const pendingOnly = ref(false);
const recent = computed(() => (pendingOnly.value ? props.files.filter(file => file.status === 'PENDING') : props.files).slice(0, 5));
const upcoming = computed(() => props.tasks.filter(task => task.deadline > props.now).sort((a, b) => a.deadline - b.deadline).slice(0, 2));
const today = computed(() => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(props.now));
const daysLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - props.now) / 86400000));
const monthLabel = (deadline: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric' }).format(deadline);
const dayLabel = (deadline: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', day: '2-digit' }).format(deadline).replace('日', '');
</script>
