<template>
  <div class="demo-shell" :class="{ 'home-view': pane === 'overview', 'work-view': !isLoginView }">
    <aside class="sidebar">
      <a class="brand" href="#overview"><span class="brand-mark"><el-icon><Collection /></el-icon></span><span><strong>学院资料归档</strong><small>学院工作空间</small></span></a>
      <QuickFind v-if="!isLoginView" :files="files" :navigation="navigation" :active="!isLoginView" :disabled="busy || loading || uploadVisible || previewVisible || photoVisible || detailsVisible" @navigate="navigate($event as Pane)" @detail="openDetail" />
      <div class="sidebar-label">工作空间 <span>演示版</span></div>
      <nav aria-label="演示功能导航">
        <template v-for="item in navigation" :key="item.id">
          <div v-if="['archives', 'chat', 'assistant'].includes(item.id)" class="nav-group-label">{{ item.id === 'archives' ? '资料管理' : item.id === 'chat' ? '团队协作' : '辅助工具' }}</div>
          <button :data-section="item.id" :class="{ active: pane === item.id }" :aria-current="pane === item.id ? 'page' : undefined" @click="navigate(item.id)"><el-icon><component :is="item.icon" /></el-icon>{{ item.label }}<span v-if="item.id === 'audit'" class="nav-count">{{ pending.length }}</span><span v-if="item.id === 'chat' && unreadChat" class="nav-count">{{ unreadChat }}</span><span v-if="item.id === 'broadcasts' && unreadBroadcast" class="nav-count">{{ unreadBroadcast }}</span></button>
        </template>
      </nav>
      <div class="sidebar-storage"><div><span>本地归档空间</span><span>{{ (usedBytes / 1024 / 1024).toFixed(1) }} / 50 MB</span></div><progress :value="usedBytes" :max="MAX_TOTAL" aria-label="本地归档空间用量"></progress><small>资料保存在当前浏览器</small></div>
      <button class="reset-button" :disabled="busy || loading" @click="resetDemo"><el-icon><RefreshLeft /></el-icon>重置演示数据</button>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb">学院工作空间 <span>/</span><strong>{{ pageTitle }}</strong></div>
        <div class="topbar-actions">
          <ReadingSettings />
          <ThemeSettings />
          <el-select v-model="role" aria-label="切换演示角色" class="role-select" :disabled="busy"><el-option label="教师体验" value="teacher" /><el-option label="管理员体验" value="admin" /></el-select>
          <div class="avatar" aria-hidden="true">{{ role === 'teacher' ? '师' : '管' }}</div>
        </div>
      </header>
      <div v-if="isLoginView" class="demo-banner"><span class="demo-pill">在线演示</span><span>内部通讯、广播及聊天附件由服务端保存，仅已登录的授权成员可以访问。</span><span class="local-indicator"><i></i>团队协作</span></div>

      <main v-loading="loading" class="main-content">
        <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon><el-button @click="initialize">重新加载</el-button></el-alert>
        <template v-else>
          <OverviewHome v-if="pane === 'overview'" :files="files" :pending="pending.length" :approved="approvedCount" :used-bytes="usedBytes" :tasks="tasks" :now="now" :unread-chat="unreadChat" :unread-broadcast="unreadBroadcast" :disabled="loading || busy || !!loadError" @upload="openUpload" @navigate="navigate" @preview="previewFile" @photo="openPhoto" />

          <template v-else-if="pane === 'tasks'">
            <div class="page-heading"><div><p class="workspace-eyebrow">资料管理</p><h1>限时任务<span class="heading-total">{{ tasks.length }}</span></h1></div><span class="page-count">截止时间临近的任务优先</span></div>
            <div class="task-cards">
              <div class="workspace-tabs" role="group" aria-label="任务状态视图"><button :aria-pressed="taskFilter === 'all'" @click="taskFilter = 'all'">全部任务<span>{{ tasks.length }}</span></button><button :aria-pressed="taskFilter === 'active'" @click="taskFilter = 'active'">进行中<span>{{ tasks.filter(task => task.deadline > now).length }}</span></button><button :aria-pressed="taskFilter === 'closed'" @click="taskFilter = 'closed'">已截止<span>{{ tasks.filter(task => task.deadline <= now).length }}</span></button></div>
              <div class="task-list-head" aria-hidden="true"><span>任务</span><span>截止时间</span><span>提交情况</span></div>
              <article v-for="task in visibleTasks" :key="task.id" class="task-card" :class="{ 'task-closed': task.deadline <= now }">
                <div class="task-details"><span class="task-category" :data-category="task.category">{{ task.category }}</span><h2>{{ task.title }}</h2><p>{{ task.description }}</p></div>
                <div class="task-meta"><strong>{{ dateLabel(task.deadline) }}</strong><span class="task-state" :class="{ active: task.deadline > now, soon: task.deadline > now && task.deadline - now <= 3 * day }"><i></i>{{ task.deadline > now ? `${Math.ceil((task.deadline - now) / day)} 天后截止` : '已截止' }}</span></div>
                <div class="task-card-bottom"><span>{{ submittedCount(task.id) ? `已提交 ${submittedCount(task.id)} 份` : '尚未提交' }}</span><el-button :type="task.deadline > now ? 'primary' : 'default'" plain :disabled="task.deadline <= now || busy" @click="openUpload(task.id)">{{ task.deadline <= now ? '提交已截止' : submittedCount(task.id) ? '补充资料' : '提交资料' }}</el-button></div>
              </article>
            </div>
          </template>

          <ArchiveWorkspace v-else-if="pane === 'archives' || pane === 'audit'" :key="pane" :files="files" :audit="pane === 'audit'" :disabled="busy" @upload="openUpload()" @detail="openDetail" @preview="previewFile" @download="downloadFile" @remove="remove" @review="review" />
          <AiAssistant v-show="pane === 'assistant'" :key="assistantVersion" :active="pane === 'assistant'" :files="files" @navigate="navigate" @draft="useAssistantDraft" />
          <CollaborationWorkspace v-show="['chat', 'broadcasts'].includes(pane)" :active="['chat', 'broadcasts'].includes(pane)" :pane="pane" @photo="openPhoto" />
          <footer class="page-footer"><span v-if="isLoginView">学院资料归档 <i>·</i> 独立演示项目</span><span v-else>演示环境 <i>·</i> {{ ['chat', 'broadcasts'].includes(pane) ? '通讯与附件保存在已连接的服务端' : '归档资料保存在当前浏览器' }}</span><button class="photo-credits-button" @click="openPhoto()">摄影素材与来源</button></footer>
        </template>
      </main>
    </div>

    <FileDetails v-model:visible="detailsVisible" :file="detailFile" @preview="previewFile" @download="downloadFile" />
    <el-dialog v-model="photoVisible" :title="`摄影素材 · ${selectedPhoto.title}`" width="min(840px, 94vw)" class="photo-dialog">
      <img class="photo-preview-image" :src="photoUrl(selectedPhoto)" :alt="selectedPhoto.alt" :width="selectedPhoto.width" :height="selectedPhoto.height" />
      <div class="photo-preview-caption"><div><strong>摄影：{{ selectedPhoto.author }}</strong><a :href="selectedPhoto.source" target="_blank" rel="noopener noreferrer">原始作品 · Unsplash ↗</a><a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">使用许可 ↗</a></div><p>真实摄影，来自 Unsplash，经 Lorem Picsum 获取。仅用于界面场景参考，不代表本学院的活动、场所或业务档案。</p></div>
      <div class="photo-preview-selector" role="group" aria-label="选择摄影素材"><button v-for="photo in photos" :key="photo.id" :aria-pressed="selectedPhoto.id === photo.id" @click="selectedPhoto = photo"><img :src="photoUrl(photo, true)" alt="" />{{ photo.title }}</button></div>
      <template #footer><el-button @click="photoVisible = false">关闭</el-button></template>
    </el-dialog>
    <el-dialog v-model="uploadVisible" :title="selectedTask ? `提交任务：${selectedTask.title}` : '上传归档资料'" width="min(660px, 94vw)" :close-on-click-modal="false" :before-close="closeUpload">
      <el-alert title="文件只保存到当前浏览器，不会上传服务器。" type="info" :closable="false" show-icon />
      <el-form label-position="top" class="upload-form"><div class="upload-form-grid"><el-form-item label="资料分类"><el-select v-model="uploadCategory" :disabled="!!selectedTask || busy" aria-label="资料分类"><el-option v-for="category in categories" :key="category" :label="category" :value="category" /></el-select></el-form-item><el-form-item label="归档备注"><el-input v-model="remark" :disabled="busy" placeholder="选填，例如：本学期教学成果" maxlength="300" /></el-form-item></div><el-upload :key="uploadKey" drag multiple :auto-upload="false" :show-file-list="false" :accept="ACCEPT" :on-change="onFileChange" :disabled="busy"><el-icon class="upload-symbol"><UploadFilled /></el-icon><div>将文件拖到这里，或 <em>点击选择</em></div><small>Office、PDF、图片和 ZIP · 单文件 20 MB · 每次最多 20 个</small></el-upload><CameraCapture :active="uploadVisible" :disabled="busy || queue.length >= 20" @capture="onFileChange" /><div v-if="queue.length" class="queue"><div v-for="(file, i) in queue" :key="i" class="queue-item"><span><strong>{{ file.name }}</strong><small>{{ fileSize(file.size) }}</small></span><el-button link type="danger" :disabled="busy" :aria-label="`移除 ${file.name}`" @click="queue.splice(i, 1)">移除</el-button></div></div></el-form>
      <template #footer><span class="upload-total">已选 {{ queue.length }} 个文件</span><el-button :disabled="busy" @click="uploadVisible = false">取消</el-button><el-button type="primary" :loading="busy" @click="submitUpload">{{ selectedTask ? '提交任务资料' : '确认归档' }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="previewVisible" :title="previewRecord?.name || '文件预览'" width="min(860px, 94vw)" @closed="clearPreview"><img v-if="previewUrl && previewRecord?.blob.type.startsWith('image/')" class="document-preview" :src="previewUrl" alt="归档资料预览" /><iframe v-else-if="previewUrl" :src="previewUrl" class="pdf-preview" title="PDF 资料预览"></iframe><template #footer><el-button @click="previewVisible = false">关闭</el-button><el-button type="primary" @click="previewRecord && downloadFile(previewRecord)">下载文件</el-button></template></el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Bell, Calendar, ChatDotRound, Collection, Files, House, Message, Plus, RefreshLeft, Stamp, UploadFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import CameraCapture from './components/CameraCapture.vue';
import AiAssistant from './components/AiAssistant.vue';
import CollaborationWorkspace from './components/CollaborationWorkspace.vue';
import ReadingSettings from './components/ReadingSettings.vue';
import ThemeSettings from './components/ThemeSettings.vue';
import OverviewHome from './components/OverviewHome.vue';
import ArchiveWorkspace from './components/ArchiveWorkspace.vue';
import FileDetails from './components/FileDetails.vue';
import QuickFind from './components/QuickFind.vue';
import { photos, photoUrl, type Photo } from './photos';
import { collabState, unreadChat, unreadBroadcast } from './collaboration';
import { ACCEPT, MAX_TOTAL, allFiles, categories, dateLabel, deleteFile, fileError, fileSize, openDatabase, replaceFiles, saveFiles, seedFiles, wasSeeded } from './data';
import type { Archive, Status } from './data';

type Pane = 'overview' | 'archives' | 'tasks' | 'audit' | 'assistant' | 'chat' | 'broadcasts';
const pane = ref<Pane>('overview');
const isLoginView = computed(() => ['chat', 'broadcasts'].includes(pane.value) && !collabState.value);
const assistantVersion = ref(0);
const role = ref('teacher');
const files = ref<Archive[]>([]), loading = ref(true), busy = ref(false), loadError = ref('');
const detailId = ref(''), detailsVisible = ref(false);
const detailFile = computed(() => files.value.find(file => file.id === detailId.value));
function openDetail(file: Archive) { detailId.value = file.id; detailsVisible.value = true; }
const uploadVisible = ref(false), uploadCategory = ref(categories[0]), remark = ref(''), queue = ref<File[]>([]), uploadKey = ref(0), taskId = ref<number>();
const previewVisible = ref(false), previewUrl = ref(''), previewRecord = ref<Archive>();
const photoVisible = ref(false), selectedPhoto = ref<Photo>(photos[0]);
function openPhoto(photo: Photo = photos[0]) { selectedPhoto.value = photo; photoVisible.value = true; }
const now = ref(Date.now());
const day = 86400000;
const tasks = [
  { id: 1, title: '教学成果与课程建设材料', category: '教学建设', deadline: now.value + 7 * day, description: '提交课程设计、教学成果及课堂实践记录。' },
  { id: 2, title: '创新实践与学生成长记录', category: '学生工作', deadline: now.value + 3 * day, description: '提交学生竞赛、创新实践及志愿活动的阶段材料。' },
  { id: 3, title: '上一阶段社会服务总结', category: '社会服务', deadline: now.value - day, description: '社会服务阶段总结及相关证明材料。' },
];
const taskFilter = ref<'all' | 'active' | 'closed'>('all');
const visibleTasks = computed(() => tasks.filter(task => taskFilter.value === 'all' || (taskFilter.value === 'active' ? task.deadline > now.value : task.deadline <= now.value)).sort((a, b) => Number(a.deadline <= now.value) - Number(b.deadline <= now.value) || a.deadline - b.deadline));
const navigation = computed(() => [
  { id: 'overview' as Pane, label: '工作台', icon: House },
  { id: 'archives' as Pane, label: '资料归档', icon: Files },
  { id: 'tasks' as Pane, label: '限时任务', icon: Calendar },
  ...(role.value === 'admin' ? [{ id: 'audit' as Pane, label: '资料审核', icon: Stamp }] : []),
  { id: 'chat' as Pane, label: '内部通讯', icon: Message },
  { id: 'broadcasts' as Pane, label: '广播通知', icon: Bell },
  { id: 'assistant' as Pane, label: 'AI 助手', icon: ChatDotRound },
]);
const pageTitle = computed(() => navigation.value.find(item => item.id === pane.value)?.label || '工作台');
const selectedTask = computed(() => tasks.find(task => task.id === taskId.value));
const pending = computed(() => files.value.filter(file => file.status === 'PENDING'));
const approvedCount = computed(() => files.value.filter(file => file.status === 'APPROVED').length);
const usedBytes = computed(() => files.value.reduce((sum, file) => sum + file.size, 0));

const submittedCount = (id: number) => files.value.filter(file => file.taskId === id && file.status !== 'REJECTED').length;
const navigate = (next: Pane) => { if (!busy.value) location.hash = next; };
function syncRoute() {
  const requested = location.hash.slice(1) as Pane;
  pane.value = navigation.value.some(item => item.id === requested) ? requested : 'overview';
  uploadVisible.value = false; previewVisible.value = false; photoVisible.value = false; detailsVisible.value = false;
}
watch(role, () => { if (role.value !== 'admin' && pane.value === 'audit') navigate('overview'); });
async function initialize() {
  loading.value = true; loadError.value = '';
  try { await openDatabase(); if (!await wasSeeded()) await replaceFiles(await seedFiles()); files.value = await allFiles(); }
  catch (error: any) { loadError.value = error?.message || '浏览器本地存储不可用，请允许本站使用存储后重试。'; }
  finally { loading.value = false; }
}
function openUpload(id?: number) {
  if (loading.value || loadError.value || busy.value) return;
  const task = tasks.find(task => task.id === id);
  if (task && task.deadline <= Date.now()) return ElMessage.warning('任务已经截止。');
  taskId.value = id; uploadCategory.value = task?.category || categories[0]; remark.value = ''; queue.value = []; uploadKey.value++; uploadVisible.value = true;
}
function onFileChange(item: UploadFile) {
  if (!item.raw || busy.value) return;
  const message = fileError(item.raw);
  if (message) return ElMessage.warning(message);
  if (queue.value.length >= 20) return ElMessage.warning('每次最多添加 20 个文件。');
  if (queue.value.some(file => file.name === item.name && file.size === item.size)) return ElMessage.warning('此文件已经加入列表。');
  if (usedBytes.value + queue.value.reduce((sum, file) => sum + file.size, 0) + item.raw.size > MAX_TOTAL) return ElMessage.warning('演示存储上限为 50 MB，请先删除部分试传文件。');
  queue.value.push(item.raw);
}
function closeUpload(done: () => void) { if (!busy.value) done(); }
function useAssistantDraft(text: string) { openUpload(); if (uploadVisible.value) remark.value = text.slice(0, 300); }
async function submitUpload() {
  if (busy.value) return;
  if (!queue.value.length) return ElMessage.warning('请先选择文件或拍照。');
  if (selectedTask.value && selectedTask.value.deadline <= Date.now()) return ElMessage.warning('任务已截止，无法提交。');
  busy.value = true;
  try {
    await saveFiles(queue.value.map((file, index) => ({ id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`, name: file.name, category: uploadCategory.value, status: 'PENDING', remark: remark.value.trim(), createdAt: Date.now(), size: file.size, blob: file, sample: false, taskId: taskId.value })));
    files.value = await allFiles(); uploadVisible.value = false; ElMessage.success('资料已保存到本浏览器，等待演示审核。');
  } catch (error: any) { ElMessage.error(error?.message || '本地保存失败，请检查浏览器剩余空间。'); }
  finally { busy.value = false; }
}
function downloadFile(file: Archive) {
  const url = URL.createObjectURL(file.blob), link = document.createElement('a');
  link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function clearPreview() { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = ''; previewRecord.value = undefined; }
function previewFile(file: Archive) {
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.blob.type)) return ElMessage.info('此格式请下载后查看，演示支持图片及 PDF 在线预览。');
  clearPreview(); previewRecord.value = file; previewUrl.value = URL.createObjectURL(file.blob); previewVisible.value = true;
}
async function remove(file: Archive) {
  try { await ElMessageBox.confirm(`删除“${file.name}”？只会删除当前浏览器中的这条记录。`, '删除本地资料', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  busy.value = true;
  try { await deleteFile(file.id); files.value = await allFiles(); ElMessage.success('本地记录已删除。'); }
  catch { ElMessage.error('删除失败，请重试。'); } finally { busy.value = false; }
}
async function review(file: Archive, status: Status) {
  if (role.value !== 'admin' || busy.value) return;
  let reason = '';
  if (status === 'REJECTED') {
    try { const result = await ElMessageBox.prompt('请填写需要修改的内容。', '驳回资料', { inputPlaceholder: '例如：请补充资料说明和活动日期', inputValidator: value => !!value?.trim() && value.trim().length <= 200 || '请填写 1–200 字的驳回原因', confirmButtonText: '确认驳回', cancelButtonText: '取消' }); reason = result.value.trim(); } catch { return; }
  }
  busy.value = true;
  try { await saveFiles([{ ...file, status, rejectReason: reason }]); files.value = await allFiles(); ElMessage.success(status === 'APPROVED' ? '演示资料已通过审核。' : '已记录修改建议。'); }
  catch { ElMessage.error('审核结果保存失败，请重试。'); } finally { busy.value = false; }
}
async function resetDemo() {
  try { await ElMessageBox.confirm('将清除本浏览器的试传文件和审核操作，并重新生成 5 份示例资料。主题选择会保留。', '重置演示数据', { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }); } catch { return; }
  busy.value = true;
  try { await replaceFiles(await seedFiles()); files.value = await allFiles(); uploadVisible.value = false; previewVisible.value = false; assistantVersion.value++; ElMessage.success('演示数据已重置。'); }
  catch { ElMessage.error('重置失败，请重试。'); } finally { busy.value = false; }
}
let timer: ReturnType<typeof setInterval>;
onMounted(() => { syncRoute(); window.addEventListener('hashchange', syncRoute); void initialize(); timer = setInterval(() => { now.value = Date.now(); }, 30000); });
onBeforeUnmount(() => { window.removeEventListener('hashchange', syncRoute); clearInterval(timer); clearPreview(); });
</script>
