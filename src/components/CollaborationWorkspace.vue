<template>
  <section class="collaboration-page" :aria-label="pane === 'chat' ? '内部通讯工作区' : '广播通知工作区'">
    <div class="page-heading"><div><div class="overline">{{ pane === 'chat' ? 'TEAM CONVERSATIONS' : 'COLLEGE BULLETIN' }}</div><h1>{{ pane === 'chat' ? '内部通讯' : '广播通知' }}</h1><p>{{ pane === 'chat' ? '让讨论与资料，在同一个工作空间流转。' : '重要安排，及时传达。' }}</p></div><div v-if="state" class="collab-account"><span>{{ state.user.name }}<small>{{ status === 'connected' ? '实时同步中' : '正在重连' }}</small></span><el-button :disabled="busy" @click="logout">退出通讯</el-button></div></div>
    <div v-if="!state" class="collab-login panel">
      <div class="collab-login-copy"><span class="collab-symbol"><el-icon><ChatDotRound /></el-icon></span><h2>连接你的学院团队</h2><p>使用独立通讯账号登录，在不同浏览器或设备间交流。消息、广播与附件保存在通讯服务器。</p><ul><li>私聊与多人工作群</li><li>附件传输、未读提醒与消息置顶</li><li>管理员广播与已读标记</li></ul><small>通讯权限由登录账号决定，与右上角的演示角色无关。</small></div>
      <form class="collab-login-form" @submit.prevent="login"><h3>登录内部通讯</h3><label>通讯服务地址<input v-model="address" type="url" required placeholder="https://team.example.com" :disabled="busy" /></label><label>通讯账号<input v-model="username" autocomplete="username" required maxlength="40" placeholder="例如 teacher1" :disabled="busy" /></label><label>通讯密码<input v-model="password" type="password" autocomplete="current-password" required maxlength="128" :disabled="busy" /></label><p v-if="error || connectionError" class="collab-error" role="alert">{{ error || connectionError }}</p><el-button type="primary" native-type="submit" :loading="busy">登录并连接</el-button><p class="collab-hint">首次使用由管理员提供账号与服务地址。登录状态只保留在当前页面，刷新后需重新登录。</p></form>
    </div>
    <template v-else>
      <div v-if="error || connectionError" class="collab-error" role="alert">{{ error || connectionError }}</div>
      <div v-if="pane === 'chat'" class="chat-layout">
        <aside class="chat-directory"><div class="chat-directory-top"><strong>工作通讯录</strong><el-button link type="primary" :disabled="busy" @click="groupVisible = true">新建群聊</el-button></div><el-input v-model="search" placeholder="搜索会话或联系人" aria-label="搜索会话或联系人" :prefix-icon="Search" clearable /><div class="directory-tabs"><button :class="{ active: listTab === 'rooms' }" @click="listTab = 'rooms'">会话 {{ state.rooms.length }}</button><button :class="{ active: listTab === 'contacts' }" @click="listTab = 'contacts'">联系人</button></div>
          <div class="directory-list"><template v-if="listTab === 'rooms'"><button v-for="room in sortedRooms" :key="room.id" class="conversation-item" :class="{ selected: selected === room.id }" :disabled="busy" @click="selectRoom(room.id)"><span class="contact-avatar">{{ room.kind === 'group' ? '群' : roomName(room).slice(0, 1) }}</span><span><strong>{{ roomName(room) }}</strong><small>{{ room.last?.content || (room.last ? '附件消息' : '开始交流，分享资料') }}</small></span><b v-if="room.unread">{{ room.unread > 99 ? '99+' : room.unread }}</b></button><p v-if="!sortedRooms.length" class="directory-empty">暂无会话，可从联系人发起私聊。</p></template><template v-else><button v-for="person in contacts" :key="person.id" class="conversation-item" :disabled="busy" @click="startPrivate(person.id)"><span class="contact-avatar">{{ person.name.slice(0, 1) }}</span><span><strong>{{ person.name }}</strong><small>{{ person.role === 'admin' ? '通讯管理员' : '学院成员' }}</small></span><span>↗</span></button></template></div>
        </aside>
        <div class="chat-conversation"><template v-if="currentRoom"><header class="conversation-header"><div><h2>{{ roomName(currentRoom) }}</h2><p>{{ currentRoom.kind === 'group' ? `${currentRoom.members.length} 人工作群` : '私密会话 · 仅双方可访问' }}</p></div><el-button link :disabled="busy" @click="exportConversation">导出当前记录</el-button></header>
            <div v-if="pins.length" class="pinned-messages"><div><el-icon><Top /></el-icon>置顶消息 <span>{{ pins.length }}/5</span></div><article v-for="message in pins" :key="message.id"><button class="pin-content" @click="viewPinned(message)"><strong>{{ message.author }}</strong>{{ message.content || message.files.map(file => file.name).join('、') }}</button><button v-if="currentRoom.canPin" class="pin-remove" :disabled="busy" :aria-label="`取消置顶消息 ${message.id}`" @click="pinMessage(message, false)">取消置顶</button></article></div>
            <div ref="chatScroll" class="chat-history" role="log" aria-label="聊天消息" aria-live="polite"><button v-if="hasMore" class="load-history" :disabled="loadingMessages" @click="loadOlder">加载更早消息</button><p v-if="loadingMessages && !messages.length" class="directory-empty">正在加载消息…</p><div v-if="!messages.length && !loadingMessages" class="conversation-empty"><el-icon><ChatDotRound /></el-icon><h3>从一句问候开始</h3><p>发送消息或资料，开启这次讨论。</p></div><article v-for="message in messages" :id="`chat-message-${message.id}`" :key="message.id" class="chat-message" :class="{ mine: message.user === state.user.id }"><div class="chat-message-meta"><strong>{{ message.author }}</strong><time>{{ time(message.created_at) }}</time><span v-if="message.pinned">已置顶</span></div><div v-if="message.content" class="chat-bubble">{{ message.content }}</div><div v-for="file in message.files" :key="file.id" class="chat-attachment"><el-icon><Document /></el-icon><span><strong>{{ file.name }}</strong><small>{{ fileSize(file.size) }}</small></span><el-button link type="primary" @click="download(file)">下载</el-button></div><button v-if="currentRoom.canPin" class="message-pin-button" :disabled="busy" @click="pinMessage(message, !message.pinned)">{{ message.pinned ? '取消置顶' : '置顶消息' }}</button></article></div>
            <form class="chat-composer" @submit.prevent="sendMessage"><div class="chat-toolbar"><label class="attachment-picker" :class="{ disabled: busy }"><el-icon><Paperclip /></el-icon>传输资料<input ref="fileInput" type="file" multiple :accept="accept" :disabled="busy" aria-label="添加聊天附件" @change="selectFiles" /></label><small>单个 20 MB · 每次最多 5 个</small></div><div v-if="queue.length" class="chat-queue"><div v-for="(item, index) in queue" :key="item.key"><span>{{ item.file.name }}<small>{{ item.uploaded ? '已上传，待发送' : item.progress ? `上传 ${item.progress}%` : fileSize(item.file.size) }}</small></span><button type="button" :disabled="busy" :aria-label="`移除附件 ${item.file.name}`" @click="removeQueued(index)">×</button></div></div><label class="sr-only" for="chat-input">聊天消息内容</label><textarea id="chat-input" v-model="draft" rows="3" maxlength="4000" :disabled="busy" placeholder="输入消息，与同事交流…" @keydown="sendKey"></textarea><div class="chat-composer-bottom"><span>{{ sendError ? '未发送成功，内容已保留，可重试。' : 'Ctrl / ⌘ + Enter 发送' }}</span><el-button type="primary" native-type="submit" :loading="busy" :disabled="!draft.trim() && !queue.length">{{ sendError ? '重试发送' : '发送消息' }}</el-button></div></form>
          </template><div v-else class="conversation-empty"><el-icon><ChatDotRound /></el-icon><h3>选择一个会话</h3><p>在左侧选择工作群，或从联系人发起私聊。</p></div></div>
      </div>
      <div v-else class="broadcast-workspace"><div class="broadcast-toolbar"><div><strong>{{ state.broadcasts.length }} 条广播</strong><span>{{ state.broadcasts.filter(item => !item.isRead).length }} 条未读</span></div><el-button v-if="state.user.role === 'admin'" type="primary" :icon="Plus" @click="noticeVisible = true">发布广播</el-button><el-tag v-else type="info">由通讯管理员发布</el-tag></div><p v-if="!state.broadcasts.length" class="panel directory-empty">暂无广播，管理员发布后会实时显示在这里。</p><article v-for="notice in state.broadcasts" :key="notice.id" class="broadcast-card" :class="{ pinned: notice.pinned }"><div class="broadcast-meta"><span v-if="notice.pinned" class="broadcast-pin"><el-icon><Top /></el-icon>置顶</span><span>{{ notice.author }}</span><time>{{ time(notice.created_at) }}</time><el-tag v-if="!notice.isRead" size="small">未读</el-tag></div><h2>{{ notice.title }}</h2><p>{{ notice.content }}</p><footer><span>{{ notice.isRead ? '已读' : '发给全体通讯成员' }}</span><div><el-button v-if="!notice.isRead" link type="primary" :disabled="busy" @click="readBroadcast(notice.id)">标记已读</el-button><el-button v-if="state.user.role === 'admin'" link type="primary" :disabled="busy" @click="pinBroadcast(notice)">{{ notice.pinned ? '取消置顶广播' : '置顶广播' }}</el-button></div></footer></article></div>
    </template>
    <el-dialog v-model="groupVisible" title="新建工作群" width="min(520px, 94vw)" :close-on-click-modal="false"><el-form label-position="top"><el-form-item label="群名称"><el-input v-model="groupName" maxlength="60" aria-label="群名称" /></el-form-item><el-form-item label="邀请成员"><div class="group-members"><label v-for="person in state?.contacts.filter(person => person.id !== state?.user.id)" :key="person.id"><input v-model="groupMembers" type="checkbox" :value="person.id" />{{ person.name }}</label></div></el-form-item></el-form><p class="collab-hint">加入的成员可访问该群全部消息和已发送资料。</p><template #footer><el-button :loading="busy" type="primary" @click="createGroup">创建群聊</el-button></template></el-dialog>
    <el-dialog v-model="noticeVisible" title="发布广播" width="min(660px, 94vw)" :close-on-click-modal="false" :before-close="closeNotice"><el-form label-position="top"><el-form-item label="广播标题"><el-input v-model="noticeTitle" maxlength="100" :disabled="busy" aria-label="广播标题" /></el-form-item><el-form-item label="广播内容"><el-input v-model="noticeContent" type="textarea" :rows="7" maxlength="6000" show-word-limit :disabled="busy" aria-label="广播内容" /></el-form-item></el-form><p class="collab-hint">发布后全体通讯成员可见。只在本系统内广播，不发送短信或邮件。</p><template #footer><el-button :disabled="busy" @click="noticeVisible = false">取消</el-button><el-button type="primary" :loading="busy" @click="publishBroadcast">确认发布</el-button></template></el-dialog>
    <el-dialog v-model="pinnedVisible" title="置顶消息详情" width="min(600px, 94vw)"><div v-if="viewedPin"><p class="chat-message-meta">{{ viewedPin.author }} · {{ time(viewedPin.created_at) }}</p><p class="pinned-full-text">{{ viewedPin.content }}</p><div v-for="file in viewedPin.files" :key="file.id" class="chat-attachment"><span>{{ file.name }}</span><el-button link type="primary" @click="download(file)">下载</el-button></div></div></el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChatDotRound, Document, Paperclip, Plus, Search, Top } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fileSize } from '../data';
import { collabApi, collabError as connectionError, collabState as state, collabStatus as status, collabVersion, defaultCollabBase, downloadAttachment, loginCollaboration, logoutCollaboration, refreshCollaboration, uploadAttachment, type Attachment, type Broadcast, type ChatMessage, type Room } from '../collaboration';
import '../collaboration.css';
const props = defineProps<{ pane: string; active: boolean }>();
const address = ref(defaultCollabBase()), username = ref(''), password = ref(''), error = ref(''), busy = ref(false);
const search = ref(''), listTab = ref('rooms'), selected = ref(''), messages = ref<ChatMessage[]>([]), pins = ref<ChatMessage[]>([]), hasMore = ref(false), loadingMessages = ref(false);
const draft = ref(''), sendError = ref(false), fileInput = ref<HTMLInputElement>(), chatScroll = ref<HTMLElement>();
type Queued = { key: string; file: File; uploaded?: Attachment; progress: number };
const queue = ref<Queued[]>([]), groupVisible = ref(false), groupName = ref(''), groupMembers = ref<string[]>([]);
const noticeVisible = ref(false), noticeTitle = ref(''), noticeContent = ref(''), pinnedVisible = ref(false), viewedPin = ref<ChatMessage>();
const accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png';
let loadVersion = 0, sendId = '', lastPayload = '', noticeId = '', lastNotice = '', marked = 0;
const currentRoom = computed(() => state.value?.rooms.find(room => room.id === selected.value));
const contacts = computed(() => state.value?.contacts.filter(person => person.id !== state.value?.user.id && (person.name + person.username).includes(search.value.trim())) || []);
const roomName = (room: Room) => room.kind === 'group' ? room.name : state.value?.contacts.find(person => room.members.includes(person.id) && person.id !== state.value?.user.id)?.name || '私聊';
const sortedRooms = computed(() => [...(state.value?.rooms || [])].filter(room => roomName(room).includes(search.value.trim())).sort((a, b) => (b.last?.created_at || 0) - (a.last?.created_at || 0)));
const time = (timestamp: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(timestamp);
async function action(fn: () => Promise<void>) { if (busy.value) return; busy.value = true; error.value = ''; try { await fn(); } catch (reason: any) { error.value = reason.message || '操作失败，请重试。'; ElMessage.error(error.value); } finally { busy.value = false; } }
async function login() { await action(async () => { await loginCollaboration(address.value, username.value.trim(), password.value); password.value = ''; selected.value = state.value?.rooms[0]?.id || ''; await loadMessages(); }); }
async function discardDraft() {
  if (draft.value.trim() || queue.value.length) { try { await ElMessageBox.confirm('当前还有未发送内容，确定放弃并继续？', '未发送草稿', { confirmButtonText: '放弃草稿', cancelButtonText: '继续编辑' }); } catch { return false; } }
  for (const item of queue.value) if (item.uploaded) await collabApi('/files/discard', { id: item.uploaded.id }).catch(() => {});
  draft.value = ''; queue.value = []; sendError.value = false; sendId = ''; lastPayload = ''; return true;
}
async function logout() { if (busy.value || !await discardDraft()) return; await action(async () => { await logoutCollaboration(); loadVersion++; selected.value = ''; messages.value = []; pins.value = []; noticeVisible.value = false; groupVisible.value = false; }); }
async function selectRoom(id: string) { if (busy.value || selected.value === id || !await discardDraft()) return; selected.value = id; marked = 0; messages.value = []; pins.value = []; await loadMessages(); }
async function loadMessages(older = false) {
  if (!selected.value || !state.value) return;
  const id = selected.value, version = ++loadVersion, atBottom = !chatScroll.value || chatScroll.value.scrollHeight - chatScroll.value.scrollTop - chatScroll.value.clientHeight < 80;
  loadingMessages.value = true;
  try {
    const result = await collabApi(`/rooms/${id}/messages${older && messages.value.length ? `?before=${messages.value[0].id}` : ''}`);
    if (version !== loadVersion || selected.value !== id || !state.value) return;
    if (older) messages.value = [...result.items, ...messages.value];
    else { const merged = new Map(messages.value.map(message => [message.id, message])); for (const message of result.items) merged.set(message.id, message); messages.value = [...merged.values()].sort((a, b) => a.id - b.id); }
    pins.value = result.pins; hasMore.value = older || messages.value.length <= 100 ? result.hasMore : hasMore.value;
    const latest = messages.value[messages.value.length - 1]?.id || 0;
    if (props.active && props.pane === 'chat' && latest > marked) { marked = latest; await collabApi('/read', { room: id, lastId: latest }); }
    await nextTick(); if (!older && atBottom) chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight });
  } catch (reason: any) { if (version === loadVersion) error.value = reason.message; } finally { if (version === loadVersion) loadingMessages.value = false; }
}
const loadOlder = () => loadMessages(true);
async function startPrivate(id: string) { if (!await discardDraft()) return; await action(async () => { const room = await collabApi('/rooms', { kind: 'private', members: [id] }); await refreshCollaboration(); selected.value = room.id; messages.value = []; pins.value = []; marked = 0; listTab.value = 'rooms'; search.value = ''; await loadMessages(); }); }
async function createGroup() { if (!await discardDraft()) return; await action(async () => { const room = await collabApi('/rooms', { kind: 'group', name: groupName.value, members: groupMembers.value }); await refreshCollaboration(); groupVisible.value = false; groupName.value = ''; groupMembers.value = []; selected.value = room.id; messages.value = []; pins.value = []; marked = 0; await loadMessages(); }); }
function selectFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || []);
  for (const file of files) {
    if (queue.value.length >= 5) { ElMessage.warning('每次最多发送 5 个附件。'); break; }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024 || !accept.split(',').includes('.' + file.name.split('.').pop()?.toLowerCase())) { ElMessage.warning(`${file.name}：请使用支持格式，单文件最大 20 MB。`); continue; }
    queue.value.push({ key: crypto.randomUUID(), file, progress: 0 });
  }
  (event.target as HTMLInputElement).value = '';
}
async function removeQueued(index: number) { if (busy.value) return; const item = queue.value[index]; await action(async () => { if (item.uploaded) await collabApi('/files/discard', { id: item.uploaded.id }); queue.value.splice(index, 1); }); }
function sendKey(event: KeyboardEvent) { if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void sendMessage(); } }
async function sendMessage() {
  if (!selected.value || (!draft.value.trim() && !queue.value.length)) return;
  await action(async () => {
    try {
      for (const item of queue.value) if (!item.uploaded) item.uploaded = await uploadAttachment(selected.value, item.file, percent => { item.progress = percent; });
      const payload = { room: selected.value, content: draft.value.trim(), files: queue.value.map(item => item.uploaded!.id) };
      const signature = JSON.stringify(payload); if (signature !== lastPayload) { sendId = crypto.randomUUID(); lastPayload = signature; }
      await collabApi('/messages', { ...payload, clientId: sendId });
      draft.value = ''; queue.value = []; sendError.value = false; sendId = ''; lastPayload = ''; await refreshCollaboration(); await loadMessages();
      await nextTick(); chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight });
    } catch (reason) { sendError.value = true; throw reason; }
  });
}
async function pinMessage(message: ChatMessage, pinned: boolean) { await action(async () => { await collabApi('/messages/pin', { id: message.id, pinned }); const loaded = messages.value.find(item => item.id === message.id); if (loaded) loaded.pinned = Number(pinned); await loadMessages(); }); }
function viewPinned(message: ChatMessage) { viewedPin.value = message; pinnedVisible.value = true; }
async function download(file: Attachment) { try { await downloadAttachment(file); } catch (reason: any) { ElMessage.error(reason.message); } }
function exportConversation() {
  const text = messages.value.map(message => `${message.author}  ${time(message.created_at)}\n${message.content}\n${message.files.map(file => `附件：${file.name}`).join('\n')}`).join('\n\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = `${currentRoom.value ? roomName(currentRoom.value) : '会话'}-已加载记录.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function closeNotice(done: () => void) { if (!busy.value) done(); }
async function publishBroadcast() { await action(async () => { const payload = { title: noticeTitle.value.trim(), content: noticeContent.value.trim() }, signature = JSON.stringify(payload); if (signature !== lastNotice) { noticeId = crypto.randomUUID(); lastNotice = signature; } await collabApi('/broadcasts', { ...payload, clientId: noticeId }); noticeVisible.value = false; noticeTitle.value = ''; noticeContent.value = ''; noticeId = ''; lastNotice = ''; await refreshCollaboration(); ElMessage.success('广播已发布给全体通讯成员。'); }); }
async function pinBroadcast(notice: Broadcast) { await action(async () => { await collabApi('/broadcasts/pin', { id: notice.id, pinned: !notice.pinned }); await refreshCollaboration(); }); }
async function readBroadcast(id: number) { await action(async () => { await collabApi('/broadcasts/read', { id }); await refreshCollaboration(); }); }
watch(collabVersion, () => { if (props.active && props.pane === 'chat' && selected.value) void loadMessages(); });
watch(() => state.value?.user.id, (id, previous) => {
  if (id !== previous) { loadVersion++; messages.value = []; pins.value = []; selected.value = state.value?.rooms[0]?.id || ''; marked = 0; draft.value = ''; queue.value = []; noticeTitle.value = ''; noticeContent.value = ''; groupMembers.value = []; groupName.value = ''; noticeVisible.value = false; groupVisible.value = false; pinnedVisible.value = false; viewedPin.value = undefined; lastPayload = ''; lastNotice = ''; sendId = ''; noticeId = ''; sendError.value = false; }
});
watch(() => [props.active, props.pane], () => { if (props.active && props.pane === 'chat') void loadMessages(); });
function warnLeaving(event: BeforeUnloadEvent) { if (busy.value || draft.value || queue.value.length) { event.preventDefault(); event.returnValue = ''; } }
window.addEventListener('beforeunload', warnLeaving);
onBeforeUnmount(() => { loadVersion++; window.removeEventListener('beforeunload', warnLeaving); });
</script>
