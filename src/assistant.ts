import { statusText, type Archive } from './data';

export type Message = { id: number; role: 'user' | 'assistant'; content: string; source: string; failed?: boolean };
export type ArchiveContext = ReturnType<typeof archiveContext>;
export function archiveContext(files: Archive[]) {
  return {
    total: files.length,
    pending: files.filter(file => file.status === 'PENDING').length,
    approved: files.filter(file => file.status === 'APPROVED').length,
    rejected: files.filter(file => file.status === 'REJECTED').length,
    records: files.slice(0, 20).map(file => ({ name: file.name.slice(0, 200), category: file.category, status: statusText[file.status], remark: file.remark.slice(0, 300) })),
  };
}

// This is deliberately a local help library, never presented as a model response.
export function localGuidance(question: string, context?: ArchiveContext): string {
  if (/拍照|摄像头|相机/.test(question)) return '拍照归档步骤\n1. 打开「资料归档」，点击「上传资料」。\n2. 选择「摄像头拍照」，允许浏览器访问相机。\n3. 拍照后检查清晰度，可以重拍或切换镜头。\n4. 点击「使用照片」加入列表，再点击「确认归档」。\n\n相机需要 HTTPS 或 localhost；不会录音。若设备不可用，也可选择已有照片。';
  if (/换肤|主题|颜色/.test(question)) return '点击右上角「换肤」，可选择青竹绿、学院蓝、暖砂金或海棠红。主题会保留在当前浏览器，刷新后继续使用。';
  if (/起草|草稿|说明|文案|备注/.test(question)) return '【归档说明模板 · 请按实际材料补充】\n本次归档用于记录【项目或活动名称】的建设过程。材料包含【文件内容】，涉及【时间、参与人员及实施情况】。请补充可核实的成果与附件清单，并检查文件名称、日期和资料完整性后提交审核。';
  if (/审核|驳回|修改/.test(question)) return '审核操作指引\n切换右上角「管理员体验」，进入「资料审核」。核对文件分类、可读性、活动日期和说明后，选择「通过」或「驳回」。驳回必须填写 1–200 字的修改原因。\n\n建议意见模板：请补充【具体缺项】，并核对【日期或数据】后重新整理材料。助手只给出建议，不会代替你审核或删除资料。';
  if (/任务|截止|提交/.test(question)) return '进入「限时任务」查看任务要求和截止时间。在进行中的任务中点击「提交资料」，上传文件或拍照后确认提交；已截止任务不能继续提交。演示中的任务状态和资料仅用于本浏览器体验。';
  if (/统计|清单|分析|归档|分类/.test(question)) {
    if (!context) return '勾选下方「附带归档清单」后再发送，我可以依据当前浏览器中的资料数量和分类给出本地整理提示。仅使用文件名、分类、状态和备注，不读取文件正文。';
    return `当前归档概览\n共 ${context.total} 份资料：待审核 ${context.pending} 份，已通过 ${context.approved} 份，需修改 ${context.rejected} 份。\n\n整理建议\n1. 优先补齐需修改资料的缺项，再处理待审核材料。\n2. 文件名建议采用「日期－项目－材料类型」。\n3. 教学设计归入教学建设，论文项目归入科研成果，学生活动归入学生工作，校企合作归入社会服务；最终以实际内容为准。\n\n以下仅列出最近 ${context.records.length} 份记录的元数据，未读取正文：\n${context.records.map(file => `• ${file.name}｜${file.category}｜${file.status}`).join('\n') || '暂无资料。'}`;
  }
  return '当前使用离线指引，尚未连接大模型。我可以提供拍照上传、主题切换、任务提交、审核步骤、归档统计和说明模板。\n\n需要自由问答、润色或连续追问时，请点击「连接 AI」，连接已配置 DeepSeek 或兼容接口的助手服务。';
}

export function normalizeGateway(value: string) {
  const url = new URL(value.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw new Error('请填写助手服务的 HTTPS 地址；本机服务可用 http://localhost。');
  return url.href.replace(/\/$/, '');
}
export async function gatewayRequest(base: string, token: string, path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(`${base}/api/assistant/${path}`, {
    method: body ? 'POST' : 'GET', mode: 'cors', credentials: 'omit', redirect: 'error', signal,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('此地址不是助手服务，请核对服务地址与部署配置。'); }
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '助手服务暂不可用，请稍后重试。');
  return result;
}
