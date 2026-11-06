<template>
  <div class="home-overview">
    <section class="home-hero" aria-labelledby="home-title">
      <p class="home-eyebrow">学院工作台</p>
      <h1 id="home-title">学院资料，<br />有序归档。</h1>
      <p class="home-intro">上传资料、跟进任务，与同事保持同步。</p>
      <div class="home-actions">
        <el-button type="primary" :disabled="disabled" @click="emit('upload')">上传资料</el-button>
        <button class="home-link" @click="emit('navigate', 'archives')">浏览归档 <el-icon><ArrowRight /></el-icon></button>
      </div>
    </section>

    <section class="home-library" aria-labelledby="recent-title">
      <header class="home-section-heading"><h2 id="recent-title">最近归档</h2><button class="home-link" @click="emit('navigate', 'archives')">查看全部 <el-icon><ArrowRight /></el-icon></button></header>
      <div v-if="recent.length" class="recent-files">
        <button v-for="file in recent" :key="file.id" class="recent-file" :aria-label="`预览 ${file.name}`" @click="emit('preview', file)">
          <span class="recent-file-icon"><el-icon><Document /></el-icon></span>
          <span class="recent-file-name"><strong>{{ file.name }}</strong><small>{{ file.category }} · {{ fileSize(file.size) }}</small></span>
          <span class="recent-file-status" :class="file.status.toLowerCase()"><i></i>{{ statusText[file.status] }}</span>
          <time>{{ dateLabel(file.createdAt) }}</time>
          <el-icon class="recent-file-arrow"><ArrowRight /></el-icon>
        </button>
      </div>
      <div v-else class="home-empty"><el-icon><FolderOpened /></el-icon><h3>还没有归档资料</h3><p>上传文档或拍摄照片，开始整理。</p><button class="home-link" :disabled="disabled" @click="emit('upload')">上传资料 <el-icon><ArrowRight /></el-icon></button></div>
      <dl class="home-summary" aria-label="归档概览">
        <div><dt>资料总数</dt><dd>{{ files.length }}<small>份</small></dd></div>
        <div><dt>等待审核</dt><dd>{{ pending }}<small>份</small></dd></div>
        <div><dt>已通过审核</dt><dd>{{ approved }}<small>份</small></dd></div>
        <div><dt>本地存储</dt><dd>{{ (usedBytes / 1024 / 1024).toFixed(1) }}<small>/ 50 MB</small></dd></div>
      </dl>
    </section>

    <div class="home-bottom">
      <section class="home-tasks" aria-labelledby="home-tasks-title">
        <header class="home-section-heading"><h2 id="home-tasks-title">待办任务</h2><button class="home-link" @click="emit('navigate', 'tasks')">全部任务 <el-icon><ArrowRight /></el-icon></button></header>
        <article v-for="task in upcoming" :key="task.id" class="home-task">
          <div><span>{{ task.category }}<i>·</i>{{ Math.max(0, Math.ceil((task.deadline - now) / 86400000)) }} 天后截止</span><h3>{{ task.title }}</h3><small>截止 {{ dateLabel(task.deadline) }}</small></div>
          <button class="home-link" :disabled="disabled" :aria-label="`提交资料：${task.title}`" @click="emit('upload', task.id)">提交 <el-icon><ArrowRight /></el-icon></button>
        </article>
        <p v-if="!upcoming.length" class="home-quiet">暂无待办任务。</p>
      </section>
      <section class="home-team" aria-labelledby="home-team-title">
        <header class="home-section-heading"><h2 id="home-team-title">沟通与协作</h2></header>
        <button class="home-shortcut" @click="emit('navigate', 'chat')"><el-icon><ChatDotRound /></el-icon><span><strong>内部通讯</strong><small>联系同事，传输资料</small></span><b v-if="unreadChat">{{ unreadChat }} 条未读</b><el-icon><ArrowRight /></el-icon></button>
        <button class="home-shortcut" @click="emit('navigate', 'broadcasts')"><el-icon><Bell /></el-icon><span><strong>广播通知</strong><small>查看学院通知与工作安排</small></span><b v-if="unreadBroadcast">{{ unreadBroadcast }} 条未读</b><el-icon><ArrowRight /></el-icon></button>
        <button class="home-shortcut" @click="emit('navigate', 'assistant')"><el-icon><EditPen /></el-icon><span><strong>AI 助手</strong><small>整理清单，起草归档说明</small></span><el-icon><ArrowRight /></el-icon></button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, Bell, ChatDotRound, Document, EditPen, FolderOpened } from '@element-plus/icons-vue';
import { dateLabel, fileSize, statusText, type Archive } from '../data';
type Destination = 'archives' | 'tasks' | 'chat' | 'broadcasts' | 'assistant';
const props = defineProps<{
  files: Archive[]; pending: number; approved: number; usedBytes: number; now: number;
  tasks: { id: number; title: string; category: string; deadline: number }[];
  unreadChat: number; unreadBroadcast: number; disabled: boolean;
}>();
const emit = defineEmits<{ (e: 'upload', taskId?: number): void; (e: 'navigate', destination: Destination): void; (e: 'preview', file: Archive): void }>();
const recent = computed(() => props.files.slice(0, 3));
const upcoming = computed(() => props.tasks.filter(task => task.deadline > props.now).sort((a, b) => a.deadline - b.deadline).slice(0, 2));
</script>
