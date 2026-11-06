<template>
  <div class="home-overview">
    <header class="home-heading">
      <div><p class="home-date">{{ today }}</p><h1>工作台</h1><p class="home-description">查看归档进度，继续手头的工作。</p></div>
      <div class="home-actions"><el-button :icon="FolderOpened" @click="emit('navigate', 'archives')">浏览归档</el-button><el-button type="primary" :icon="Plus" :disabled="disabled" @click="emit('upload')">上传资料</el-button></div>
    </header>
    <dl class="home-summary" aria-label="归档概览">
      <div><dt><el-icon><Files /></el-icon>归档资料</dt><dd>{{ files.length }}<small>份资料</small></dd></div>
      <div><dt><el-icon><Clock /></el-icon>等待审核</dt><dd>{{ pending }}<small>份待处理</small></dd></div>
      <div><dt><el-icon><CircleCheck /></el-icon>已通过审核</dt><dd>{{ approved }}<small>份已完成</small></dd></div>
      <div><dt><el-icon><Coin /></el-icon>本地存储</dt><dd>{{ (usedBytes / 1024 / 1024).toFixed(1) }}<small>/ 50 MB</small></dd></div>
    </dl>
    <div class="home-columns">
      <section class="home-library" aria-labelledby="recent-title">
        <header class="home-section-heading"><h2 id="recent-title">最近归档</h2><button class="home-link" @click="emit('navigate', 'archives')">查看全部 <el-icon><ArrowRight /></el-icon></button></header>
        <div class="home-view-switch" role="group" aria-label="首页资料筛选"><button :aria-pressed="!pendingOnly" @click="pendingOnly = false">全部资料</button><button :aria-pressed="pendingOnly" @click="pendingOnly = true">待审核 <span>{{ pending }}</span></button></div>
        <div v-if="recent.length" class="recent-files">
          <div class="recent-columns" aria-hidden="true"><span>资料名称</span><span>状态</span></div>
          <button v-for="file in recent" :key="file.id" class="recent-file" :aria-label="`预览 ${file.name}`" @click="emit('preview', file)">
            <span class="recent-file-icon" :data-category="file.category"><el-icon><Document /></el-icon></span>
            <span class="recent-file-name"><strong :title="file.name">{{ file.name }}</strong><small>{{ file.category }}<i>·</i>{{ dateLabel(file.createdAt) }}<i>·</i>{{ fileSize(file.size) }}</small></span>
            <span class="recent-file-status" :class="file.status.toLowerCase()"><i></i>{{ statusText[file.status] }}</span><el-icon class="recent-file-arrow"><ArrowRight /></el-icon>
          </button>
        </div>
        <div v-else class="home-empty"><el-icon><FolderOpened /></el-icon><h3>{{ pendingOnly ? '没有待审核的资料' : '还没有归档资料' }}</h3><p>{{ pendingOnly ? '提交新资料后，可以在这里跟进审核状态。' : '上传文档或拍摄照片，开始整理。' }}</p><button v-if="!pendingOnly" class="home-link" :disabled="disabled" @click="emit('upload')">上传资料 <el-icon><ArrowRight /></el-icon></button></div>
        <p class="home-library-note">{{ pendingOnly ? '显示待审核资料，点击文件可预览。' : '按归档时间排序，点击文件可预览。' }}</p>
      </section>
      <section class="home-tasks" aria-labelledby="home-tasks-title">
        <header class="home-section-heading"><h2 id="home-tasks-title">待办任务 <span class="section-count">{{ upcoming.length }}</span></h2><el-icon><Calendar /></el-icon></header>
        <div class="home-task-list">
          <article v-for="task in upcoming" :key="task.id" class="home-task" :data-category="task.category">
            <div class="home-task-category"><span><i></i>{{ task.category }}</span><span class="task-due" :class="{ soon: daysLeft(task.deadline) <= 3 }">{{ daysLeft(task.deadline) }} 天后截止</span></div><h3>{{ task.title }}</h3>
            <div class="home-task-bottom"><small>{{ dateLabel(task.deadline) }}</small><button class="home-link" :disabled="disabled" :aria-label="`提交资料：${task.title}`" @click="emit('upload', task.id)">提交资料 <el-icon><ArrowRight /></el-icon></button></div>
          </article>
          <p v-if="!upcoming.length" class="home-quiet">暂无待办任务。</p><button class="home-task-all" @click="emit('navigate', 'tasks')">查看全部任务 <el-icon><ArrowRight /></el-icon></button>
        </div>
      </section>
    </div>
    <section class="home-team" aria-labelledby="home-team-title">
      <header class="home-section-heading"><h2 id="home-team-title">团队与工具</h2><span>继续协作</span></header>
      <div class="home-shortcuts">
        <button class="home-shortcut" data-section="chat" @click="emit('navigate', 'chat')"><span class="shortcut-symbol"><el-icon><ChatDotRound /></el-icon></span><span><strong>内部通讯 <b v-if="unreadChat">{{ unreadChat }}</b></strong><small>联系同事，分享工作资料</small></span><el-icon><ArrowRight /></el-icon></button>
        <button class="home-shortcut" data-section="broadcasts" @click="emit('navigate', 'broadcasts')"><span class="shortcut-symbol"><el-icon><Bell /></el-icon></span><span><strong>广播通知 <b v-if="unreadBroadcast">{{ unreadBroadcast }}</b></strong><small>查看学院通知与置顶消息</small></span><el-icon><ArrowRight /></el-icon></button>
        <button class="home-shortcut" data-section="assistant" @click="emit('navigate', 'assistant')"><span class="shortcut-symbol"><el-icon><EditPen /></el-icon></span><span><strong>AI 助手</strong><small>整理资料清单，起草说明</small></span><el-icon><ArrowRight /></el-icon></button>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRight, Bell, Calendar, ChatDotRound, CircleCheck, Clock, Coin, Document, EditPen, Files, FolderOpened, Plus } from '@element-plus/icons-vue';
import { dateLabel, fileSize, statusText, type Archive } from '../data';
import '../home.css';
type Destination = 'archives' | 'tasks' | 'chat' | 'broadcasts' | 'assistant';
const props = defineProps<{ files: Archive[]; pending: number; approved: number; usedBytes: number; now: number; tasks: { id: number; title: string; category: string; deadline: number }[]; unreadChat: number; unreadBroadcast: number; disabled: boolean }>();
const emit = defineEmits<{ (e: 'upload', taskId?: number): void; (e: 'navigate', destination: Destination): void; (e: 'preview', file: Archive): void }>();
const pendingOnly = ref(false);
const recent = computed(() => (pendingOnly.value ? props.files.filter(file => file.status === 'PENDING') : props.files).slice(0, 5));
const upcoming = computed(() => props.tasks.filter(task => task.deadline > props.now).sort((a, b) => a.deadline - b.deadline).slice(0, 2));
const today = computed(() => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(props.now));
const daysLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - props.now) / 86400000));
</script>
