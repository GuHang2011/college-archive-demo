<template>
  <section class="archive-workspace" :aria-label="audit ? '资料审核工作区' : '资料归档工作区'">
    <div class="page-heading"><div><p class="workspace-eyebrow">资料管理</p><h1>{{ audit ? '资料审核' : '资料归档' }}<span class="heading-total">{{ audit ? pendingCount : files.length }}</span></h1></div><el-button v-if="!audit" type="primary" :icon="Plus" :disabled="disabled" @click="emit('upload')">上传资料</el-button><span v-else class="page-count">演示管理员</span></div>
    <section class="archive-surface">
      <div v-if="!audit" class="workspace-tabs" role="group" aria-label="资料状态视图">
        <button v-for="view in views" :key="view.value" :aria-pressed="status === view.value" @click="status = view.value">{{ view.label }}<span>{{ view.count }}</span></button>
      </div>
      <div v-else class="audit-queue-heading"><span class="status-dot pending"></span>待处理队列<span>{{ pendingCount }} 份资料</span></div>
      <div class="archive-toolbar">
        <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="搜索文件名或备注" aria-label="搜索文件名或备注" />
        <el-select v-model="category" clearable placeholder="全部分类" aria-label="按分类筛选"><el-option v-for="item in categories" :key="item" :label="item" :value="item" /></el-select>
        <div class="archive-view-tools"><el-select v-model="order" aria-label="资料排序"><el-option label="最近归档" value="newest" /><el-option label="最早归档" value="oldest" /><el-option label="文件名称" value="name" /><el-option label="文件大小" value="size" /></el-select><button class="density-button" :aria-pressed="compact" aria-label="紧凑行距" @click="compact = !compact"><el-icon><Operation /></el-icon><span>紧凑</span></button></div>
      </div>
      <div v-if="keyword.trim() || category || status" class="active-filters"><span>当前筛选</span><span v-if="status">{{ statusText[status] }}</span><span v-if="category">{{ category }}</span><span v-if="keyword.trim()">“{{ keyword.trim() }}”</span><button @click="clearFilters">清除筛选</button></div>
      <el-table :data="pageFiles" row-key="id" class="archive-table" :class="{ 'is-compact': compact }" empty-text="没有符合条件的资料">
        <el-table-column label="资料名称" min-width="310"><template #default="{ row }"><div class="file-title"><ArchiveThumbnail class="file-symbol" :data-category="row.category" :blob="row.blob" /><div><button class="file-name-button" :aria-label="`查看资料详情：${row.name}`" @click="emit('detail', row)"><strong :title="row.name">{{ row.name }}</strong></button><small>{{ fileSize(row.size) }} · {{ row.sample ? '示例文件' : '本地试传' }}{{ row.taskId ? ' · 任务提交' : '' }}</small></div></div></template></el-table-column>
        <el-table-column label="分类" width="112"><template #default="{ row }"><span class="category-label" :data-category="row.category"><i></i>{{ row.category }}</span></template></el-table-column>
        <el-table-column label="审核状态" width="110"><template #default="{ row }"><span class="record-status" :data-status="row.status"><i></i>{{ statusText[row.status as Status] }}</span></template></el-table-column>
        <el-table-column label="说明" min-width="190"><template #default="{ row }"><span class="file-remark" :title="row.status === 'REJECTED' ? row.rejectReason : row.remark">{{ row.status === 'REJECTED' ? row.rejectReason : row.remark || '—' }}</span></template></el-table-column>
        <el-table-column label="归档时间" width="142"><template #default="{ row }"><time class="record-time">{{ dateLabel(row.createdAt) }}</time></template></el-table-column>
        <el-table-column label="操作" :width="audit ? 180 : 165" fixed="right"><template #default="{ row }"><div class="record-actions"><el-button link type="primary" @click="emit('preview', row)">预览</el-button><template v-if="audit"><el-button link type="success" :disabled="disabled" @click="emit('review', row, 'APPROVED')">通过</el-button><el-button link type="danger" :disabled="disabled" @click="emit('review', row, 'REJECTED')">驳回</el-button></template><template v-else><el-button link type="primary" @click="emit('download', row)">下载</el-button><el-button link type="danger" :disabled="disabled" @click="emit('remove', row)">删除</el-button></template></div></template></el-table-column>
      </el-table>
      <div class="archive-mobile-list">
        <article v-for="file in pageFiles" :key="file.id" class="archive-mobile-record">
          <button class="mobile-file-title" :aria-label="`查看资料详情：${file.name}`" @click="emit('detail', file)"><ArchiveThumbnail class="file-symbol" :data-category="file.category" :blob="file.blob" /><span><strong>{{ file.name }}</strong><small>{{ file.category }} · {{ fileSize(file.size) }}</small></span></button>
          <div class="mobile-file-meta"><span class="record-status" :data-status="file.status"><i></i>{{ statusText[file.status] }}</span><time>{{ dateLabel(file.createdAt) }}</time></div>
          <p v-if="file.status === 'REJECTED'" class="file-rejection">{{ file.rejectReason }}</p>
          <div class="record-actions"><el-button link type="primary" @click="emit('preview', file)">预览</el-button><template v-if="audit"><el-button link type="success" :disabled="disabled" @click="emit('review', file, 'APPROVED')">通过</el-button><el-button link type="danger" :disabled="disabled" @click="emit('review', file, 'REJECTED')">驳回</el-button></template><template v-else><el-button link type="primary" @click="emit('download', file)">下载</el-button><el-button link type="danger" :disabled="disabled" @click="emit('remove', file)">删除</el-button></template></div>
        </article>
      </div>
      <div v-if="!filtered.length" class="archive-empty"><el-icon><FolderOpened /></el-icon><strong>{{ audit && !pendingCount ? '暂无待审核资料' : '没有符合条件的资料' }}</strong><button v-if="keyword || category || status" class="home-link" @click="clearFilters">清除筛选</button></div>
      <footer class="archive-list-footer"><span>{{ filtered.length ? `显示 ${start + 1}–${Math.min(start + pageSize, filtered.length)} 条，共 ${filtered.length} 份资料` : '0 份资料' }}</span><el-pagination v-if="filtered.length > pageSize" v-model:current-page="page" :page-size="pageSize" :total="filtered.length" layout="prev, pager, next" small /><span v-else>{{ audit ? '审核结果仅保存在当前浏览器' : '点击文件名查看详情' }}</span></footer>
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Plus, Search, Operation, FolderOpened } from '@element-plus/icons-vue';
import { categories, dateLabel, fileSize, statusText, type Archive, type Status } from '../data';
import ArchiveThumbnail from './ArchiveThumbnail.vue';
const props = defineProps<{ files: Archive[]; audit: boolean; disabled: boolean }>();
const emit = defineEmits<{ (e: 'upload'): void; (e: 'detail' | 'preview' | 'download' | 'remove', file: Archive): void; (e: 'review', file: Archive, status: Status): void }>();
const keyword = ref(''), category = ref(''), status = ref<Status | ''>(''), order = ref('newest'), compact = ref(false), page = ref(1);
const pageSize = 12;
const pendingCount = computed(() => props.files.filter(file => file.status === 'PENDING').length);
const views = computed(() => [{ value: '' as const, label: '全部资料', count: props.files.length }, ...(['PENDING', 'APPROVED', 'REJECTED'] as Status[]).map(value => ({ value, label: statusText[value], count: props.files.filter(file => file.status === value).length }))]);
const filtered = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return props.files.filter(file => (!props.audit || file.status === 'PENDING') && (!status.value || file.status === status.value) && (!category.value || file.category === category.value) && (!query || [file.name, file.remark, file.rejectReason || ''].join(' ').toLocaleLowerCase().includes(query)))
    .sort((a, b) => order.value === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : order.value === 'size' ? b.size - a.size : order.value === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
});
const start = computed(() => (page.value - 1) * pageSize);
const pageFiles = computed(() => filtered.value.slice(start.value, start.value + pageSize));
function clearFilters() { keyword.value = ''; category.value = ''; status.value = ''; }
watch([keyword, category, status, order], () => { page.value = 1; });
watch(() => filtered.value.length, length => { page.value = Math.min(page.value, Math.max(1, Math.ceil(length / pageSize))); });
watch(() => props.audit, () => { clearFilters(); page.value = 1; });
</script>
