<template>
  <el-drawer :model-value="visible" @update:model-value="emit('update:visible', $event)" title="资料详情" size="min(480px, 94vw)" class="file-details" destroy-on-close>
    <template v-if="file">
      <div class="detail-file-heading"><ArchiveThumbnail class="detail-thumbnail" :data-category="file.category" :blob="file.blob" /><div><h2>{{ file.name }}</h2><span class="record-status" :data-status="file.status"><i></i>{{ statusText[file.status] }}</span></div></div>
      <dl class="detail-properties"><div><dt>资料分类</dt><dd><span class="category-label" :data-category="file.category"><i></i>{{ file.category }}</span></dd></div><div><dt>文件大小</dt><dd>{{ fileSize(file.size) }}</dd></div><div><dt>归档时间</dt><dd>{{ fullDate(file.createdAt) }}</dd></div><div><dt>资料来源</dt><dd>{{ file.sample ? '演示示例' : '本地上传' }}{{ file.taskId ? ' · 任务提交' : '' }}</dd></div><div><dt>保存位置</dt><dd>当前浏览器</dd></div></dl>
      <section class="detail-section"><h3>归档备注</h3><p>{{ file.remark || '未填写备注' }}</p></section>
      <section v-if="file.status === 'REJECTED'" class="detail-section detail-feedback"><h3>修改意见</h3><p>{{ file.rejectReason || '请联系审核人确认修改内容。' }}</p></section>
    </template>
    <template #footer><div v-if="file" class="detail-footer"><el-button @click="emit('preview', file)">预览文件</el-button><el-button type="primary" @click="emit('download', file)">下载文件</el-button></div></template>
  </el-drawer>
</template>
<script setup lang="ts">
import { fileSize, statusText, type Archive } from '../data';
import ArchiveThumbnail from './ArchiveThumbnail.vue';
defineProps<{ visible: boolean; file?: Archive }>();
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'preview' | 'download', file: Archive): void }>();
const fullDate = (value: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value);
</script>
