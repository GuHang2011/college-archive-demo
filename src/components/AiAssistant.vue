<template>
  <section class="assistant-page" aria-label="AI 助手工作区">
    <div class="page-heading assistant-heading">
      <div><h1>AI 助手</h1><p>整理归档清单，起草说明，查询操作方法。</p></div>
      <el-button :icon="Connection" :disabled="sending" @click="showConnection">{{ online ? '连接设置' : '连接 AI' }}</el-button>
    </div>
    <div class="assistant-layout">
      <aside class="assistant-tools">
        <div class="assistant-identity"><h2>归档工具</h2><p>选择常用问题，或直接输入。</p></div>
        <div class="assistant-status" :class="{ connected: online }"><i></i>{{ online ? `已连接 · ${model}` : '离线指引 · 未连接大模型' }}</div>
        <div class="assistant-presets"><span class="overline">常用问题</span><button v-for="item in presets" :key="item.title" :disabled="sending" @click="input = item.prompt"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.title }}<small>{{ item.description }}</small></span><span>↗</span></button></div>
        <div class="assistant-context-summary"><strong>当前浏览器 · {{ files.length }} 份资料</strong><p>可按需附带清单，帮助理解归档情况。不会读取或发送文件正文、照片。</p><el-button link type="primary" @click="emit('navigate', 'archives')">查看资料归档 →</el-button></div>
      </aside>
      <div class="assistant-chat">
        <div class="assistant-chat-top"><span>{{ online ? '与 AI 对话' : '本地操作与模板指引' }}</span><el-button link :disabled="sending || !messages.length" @click="clearMessages">清空对话</el-button></div>
        <div ref="messageList" class="assistant-messages" role="log" aria-label="助手对话记录" aria-live="polite" :aria-busy="sending">
          <div v-if="!messages.length" class="assistant-welcome"><span>需要处理什么资料？</span><p>{{ online ? '输入问题，或选择常用问题开始。' : '尚未连接 AI。你可以先使用本地指引和说明模板，连接服务后再进行自由问答。' }}</p><div class="assistant-note">生成的内容可修改，提交前请核对。</div></div>
          <article v-for="message in messages" :key="message.id" class="assistant-message" :class="message.role">
            <div class="message-byline">{{ message.role === 'user' ? '你' : message.source }}<span v-if="message.failed"> · 未完成</span></div>
            <div class="message-content">{{ message.content }}</div>
            <div v-if="message.role === 'assistant' && !message.failed" class="message-actions"><button @click="copy(message.content)">复制内容</button><button v-if="message.content.length <= 300" @click="emit('draft', message.content)">用于归档备注 ↗</button></div>
          </article>
          <p v-if="sending" class="assistant-thinking" role="status">正在等待 {{ model }} 回复…</p>
        </div>
        <div v-if="error" class="assistant-error" role="alert"><span>{{ error }}</span><el-button v-if="retryPayload" link type="primary" :disabled="sending" @click="retry">重试上次请求</el-button></div>
        <form class="assistant-composer" @submit.prevent="send()">
          <div class="assistant-context-control"><el-checkbox v-model="includeContext" :disabled="sending">附带归档清单（最多 20 条）</el-checkbox><button type="button" @click="contextVisible = true">查看发送范围</button></div>
          <label class="sr-only" for="assistant-question">向助手提问</label>
          <textarea id="assistant-question" v-model="input" :disabled="sending" maxlength="4000" rows="3" placeholder="例如：帮我起草课程建设资料的归档说明…" @keydown="onKeydown"></textarea>
          <div class="assistant-composer-bottom"><small>{{ input.length }}/4000 · Ctrl / ⌘ + Enter 发送</small><el-button v-if="sending" @click="stop">停止生成</el-button><el-button v-else type="primary" :icon="Position" native-type="submit" :disabled="!input.trim()">{{ online ? '发送给 AI' : '获取本地指引' }}</el-button></div>
          <p class="assistant-disclosure">{{ online ? '发送后，问题、最近对话及勾选的清单会交给已连接服务的模型处理。AI 建议需核对。' : '离线指引来自内置规则与模板，不是大模型生成；输入不会发送到服务器。' }} 对话仅保留在本页，刷新后清空。</p>
        </form>
      </div>
    </div>
    <el-dialog v-model="connectionVisible" title="连接 AI 服务" width="min(560px, 94vw)" :close-on-click-modal="false" @closed="cancelConnection">
      <p class="connection-intro">支持 DeepSeek 及 OpenAI 兼容接口。填写部署好的助手服务地址与访问码；服务商 API Key 由服务端保存。</p>
      <el-form label-position="top" @submit.prevent="connect"><el-form-item label="助手服务地址"><el-input v-model="gatewayInput" :disabled="connecting" aria-label="助手服务地址" placeholder="https://assistant.example.com" /></el-form-item><el-form-item label="服务访问码"><el-input v-model="tokenInput" :disabled="connecting" type="password" show-password autocomplete="off" aria-label="服务访问码" placeholder="由服务部署者提供，不是模型 API Key" /></el-form-item></el-form>
      <div v-if="connectionError" class="assistant-error" role="alert">{{ connectionError }}</div>
      <details class="connection-help"><summary>如何配置服务？</summary><p>在项目的 .env 中设置 AI_BASE_URL、AI_MODEL、AI_API_KEY 和 AI_ACCESS_TOKEN，然后运行 npm run start。本机默认地址为 http://127.0.0.1:4175。GitHub Pages 需要单独部署 HTTPS 助手服务。</p></details>
      <p class="connection-footnote">连接检查不调用模型、不消耗模型额度。更换连接或切换离线模式会清空对话；访问码只在当前页面内存中保留。</p>
      <template #footer><el-button v-if="online" :disabled="connecting" @click="disconnect">切换离线指引</el-button><el-button :loading="connecting" type="primary" @click="connect">检查并连接</el-button></template>
    </el-dialog>
    <el-dialog v-model="contextVisible" title="发送范围" width="min(620px, 94vw)"><p class="connection-intro">{{ online ? '每次发送都会附带本次问题和最近的 AI 对话（最多 6 轮）。' : '当前为离线模式，数据不会离开浏览器。' }} 只有勾选「附带归档清单」才会额外使用以下内容；文件正文和照片始终不发送。</p><pre class="context-preview">{{ JSON.stringify(context, null, 2) }}</pre></el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChatDotRound, Connection, Document, List, Position, Camera } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { Archive } from '../data';
import { archiveContext, gatewayRequest, localGuidance, normalizeGateway, type Message } from '../assistant';
import '../assistant.css';

const props = defineProps<{ files: Archive[]; active: boolean }>();
const emit = defineEmits<{ (e: 'navigate', pane: 'archives' | 'tasks'): void; (e: 'draft', text: string): void }>();
const presets = [
  { title: '整理归档清单', description: '梳理现状与下一步', icon: List, prompt: '请分析我的归档清单，给出优先处理事项和分类建议。' },
  { title: '起草材料说明', description: '从空白开始写一段', icon: Document, prompt: '请起草一份教学建设资料的归档说明，控制在 200 字内，未知信息用【待补充】标记。' },
  { title: '检查审核要点', description: '让修改意见更清楚', icon: ChatDotRound, prompt: '审核资料时应该检查哪些内容？请提供一段礼貌、具体的修改建议模板。' },
  { title: '如何拍照归档', description: '跟着步骤完成采集', icon: Camera, prompt: '如何使用摄像头拍照并完成资料归档？' },
];
const input = ref(''), messages = ref<Message[]>([]), includeContext = ref(false), contextVisible = ref(false);
const context = computed(() => archiveContext(props.files));
const online = ref(false), gateway = ref(''), accessToken = ref(''), model = ref('');
const sending = ref(false), error = ref(''), messageList = ref<HTMLElement>();
const connectionVisible = ref(false), connecting = ref(false), connectionError = ref('');
const gatewayInput = ref(''), tokenInput = ref('');
watch(gatewayInput, (next, previous) => { if (next !== previous) tokenInput.value = ''; }, { flush: 'sync' });
type Payload = { messages: { role: string; content: string }[]; context?: ReturnType<typeof archiveContext> };
const retryPayload = ref<Payload>();
let request: AbortController | undefined, connectionRequest: AbortController | undefined, messageId = 0;
const scrollToEnd = async () => { await nextTick(); messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'auto' }); };
function append(role: 'user' | 'assistant', content: string, source: string) { messages.value.push({ id: ++messageId, role, content, source }); void scrollToEnd(); }
function showConnection() {
  gatewayInput.value = gateway.value || import.meta.env.VITE_AI_GATEWAY || (['127.0.0.1', 'localhost'].includes(location.hostname) ? location.origin : '');
  tokenInput.value = accessToken.value; connectionError.value = ''; connectionVisible.value = true;
}
function cancelConnection() { connectionRequest?.abort(); tokenInput.value = ''; }
async function connect() {
  if (connecting.value) return;
  connectionError.value = '';
  let base: string;
  try { base = normalizeGateway(gatewayInput.value); } catch { connectionError.value = '请填写有效的 HTTPS 助手服务地址，本机可使用 http://127.0.0.1:4175。'; return; }
  if (!tokenInput.value.trim()) { connectionError.value = '请填写服务访问码。'; return; }
  connecting.value = true; const controller = new AbortController(); connectionRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const result = await gatewayRequest(base, tokenInput.value.trim(), 'status', controller.signal);
    if (typeof result.model !== 'string' || result.ready !== true) throw new Error('服务端尚未配置模型。请配置 AI_API_KEY、AI_MODEL 和 AI_ACCESS_TOKEN 后重启。');
    if (controller.signal.aborted) return;
    messages.value = []; error.value = ''; retryPayload.value = undefined;
    gateway.value = base; accessToken.value = tokenInput.value.trim(); model.value = result.model; online.value = true; connectionVisible.value = false;
    ElMessage.success('助手服务已连接，可以发送问题。');
  } catch (reason: any) { connectionError.value = controller.signal.aborted ? '连接检查超时或已取消，请重试。' : reason instanceof TypeError ? '无法连接助手服务，请检查地址、网络和跨域配置。' : reason.message; }
  finally { clearTimeout(timeout); connecting.value = false; }
}
function disconnect() { stop(); online.value = false; accessToken.value = ''; model.value = ''; messages.value = []; retryPayload.value = undefined; error.value = ''; connectionVisible.value = false; }
async function clearMessages() {
  try { await ElMessageBox.confirm('清空当前页面中的对话记录？', '清空对话', { confirmButtonText: '清空', cancelButtonText: '取消' }); } catch { return; }
  messages.value = []; retryPayload.value = undefined; error.value = '';
}
async function copy(text: string) { try { await navigator.clipboard.writeText(text); ElMessage.success('内容已复制。'); } catch { ElMessage.warning('浏览器未允许复制，请选中文字手动复制。'); } }
function onKeydown(event: KeyboardEvent) { if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(); } }
function stop() { request?.abort(); }
async function send() {
  const question = input.value.trim(); if (!question || sending.value) return;
  if (question.length > 4000) { error.value = '问题请控制在 4000 字以内。'; return; }
  error.value = ''; retryPayload.value = undefined;
  if (messages.value.length >= 60) { error.value = '本次对话已达到 30 轮，请清空对话后继续。'; return; }
  const history = messages.value.filter(m => m.source === 'AI' && !m.failed).slice(-12).map(({ role, content }) => ({ role, content }));
  append('user', question, online.value ? 'AI' : '本地'); input.value = '';
  if (!online.value) { append('assistant', localGuidance(question, includeContext.value ? context.value : undefined), '离线指引 · 规则与模板'); return; }
  await requestReply({ messages: [...history, { role: 'user', content: question }], ...(includeContext.value ? { context: context.value } : {}) });
}
async function retry() { if (retryPayload.value && !sending.value) await requestReply(retryPayload.value); }
async function requestReply(payload: Payload) {
  sending.value = true; error.value = ''; const controller = new AbortController(); request = controller;
  let timedOut = false; const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 65000);
  void scrollToEnd();
  try {
    const result = await gatewayRequest(gateway.value, accessToken.value, 'chat', controller.signal, payload);
    if (controller.signal.aborted) return;
    if (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 12000) throw new Error('模型未返回可用回复，请重试。');
    // A failed prompt is excluded from future history until it succeeds.
    const lastUser = [...messages.value].reverse().find(m => m.role === 'user'); if (lastUser) lastUser.failed = false;
    append('assistant', result.reply, 'AI'); retryPayload.value = undefined;
  } catch (reason: any) {
    const lastUser = [...messages.value].reverse().find(m => m.role === 'user'); if (lastUser) lastUser.failed = true;
    retryPayload.value = payload;
    error.value = controller.signal.aborted ? timedOut ? '等待回复超时，可以重试。' : '已停止生成，未收到回复。' : reason instanceof TypeError ? '连接中断，请检查网络后重试。' : reason.message;
  } finally { clearTimeout(timeout); sending.value = false; request = undefined; void scrollToEnd(); }
}
watch(() => props.active, active => { if (!active) { stop(); connectionRequest?.abort(); connectionVisible.value = false; contextVisible.value = false; } });
onBeforeUnmount(() => { stop(); connectionRequest?.abort(); });
</script>
