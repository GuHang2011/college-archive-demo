<template>
	<div class="camera-entry">
		<el-button :icon="Camera" :disabled="disabled || !active" @click="openCamera">摄像头拍照</el-button>
		<span>拍照后预览，确认加入待上传列表</span>
		<el-dialog v-model="visible" title="拍照上传" width="min(660px, 94vw)" append-to-body :close-on-click-modal="false" @close="release">
			<div class="camera-stage" :aria-busy="starting || capturing">
				<img v-if="preview" :src="preview" alt="本次拍摄的照片" />
				<video v-else ref="video" autoplay playsinline muted aria-label="摄像头实时预览" @loadeddata="onVideoReady" />
				<p v-if="starting" class="camera-status" role="status">正在开启摄像头，请允许浏览器使用相机…</p>
			</div>
			<el-alert v-if="error" :title="error" type="warning" :closable="false" show-icon class="camera-error" />
			<p class="camera-note">{{ preview ? '请确认照片清晰。加入列表后，再点击上传或提交。' : '仅拍摄照片，不录音。请将资料完整放入画面。' }}</p>
			<template #footer>
				<div class="camera-actions">
					<el-button @click="close">取消</el-button>
					<template v-if="preview">
						<el-button @click="startCamera">重拍</el-button>
						<el-button type="primary" :disabled="disabled || !active" @click="confirmPhoto">使用照片</el-button>
					</template>
					<template v-else>
						<el-button :disabled="starting || capturing" @click="switchCamera">切换前后摄像头</el-button>
						<el-button v-if="error" @click="startCamera">重试</el-button>
						<el-button type="primary" :disabled="!ready || starting || !!error" :loading="capturing" @click="takePhoto">拍照</el-button>
					</template>
				</div>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';

import { Camera } from '@element-plus/icons-vue';
import { genFileId } from 'element-plus';
import type { UploadFile, UploadRawFile } from 'element-plus';

const props = withDefaults(defineProps<{ active: boolean; disabled?: boolean }>(), { disabled: false });
const emit = defineEmits<{ (event: 'capture', file: UploadFile): void }>();
const visible = ref(false);
const video = ref<HTMLVideoElement>();
const preview = ref('');
const error = ref('');
const starting = ref(false);
const capturing = ref(false);
const ready = ref(false);
let stream: MediaStream | undefined;
let photo: File | undefined;
let requestId = 0;
let facing: 'environment' | 'user' = 'environment';

function stopStream() {
	stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
	stream = undefined;
	if (video.value) video.value.srcObject = null;
	ready.value = false;
}
function clearPhoto() {
	if (preview.value) URL.revokeObjectURL(preview.value);
	preview.value = '';
	photo = undefined;
}
function release() {
	requestId++;
	stopStream();
	clearPhoto();
	starting.value = false;
	capturing.value = false;
}
function close() { visible.value = false; release(); }
function onVideoReady() { ready.value = !!stream && !!video.value?.videoWidth; }

async function startCamera() {
	release();
	error.value = '';
	if (!visible.value || !props.active || props.disabled) return;
	if (!window.isSecureContext) {
		error.value = '当前连接无法使用摄像头，请通过 HTTPS 地址或本机 localhost 打开，也可以返回选择已有照片。';
		return;
	}
	if (!navigator.mediaDevices?.getUserMedia) {
		error.value = '当前浏览器不支持摄像头，请使用新版 Chrome、Edge 或 Safari，也可以返回选择已有照片。';
		return;
	}
	const id = ++requestId;
	starting.value = true;
	try {
		const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
		if (id !== requestId || !visible.value || !props.active || props.disabled) {
			acquired.getTracks().forEach(track => track.stop());
			return;
		}
		stream = acquired;
		stream.getVideoTracks().forEach(track => { track.onended = () => { stopStream(); error.value = '摄像头已断开，请检查设备后重试。'; }; });
		await nextTick();
		if (id !== requestId) return;
		if (!video.value) throw new Error('预览窗口未准备好，请重试。');
		video.value.srcObject = acquired;
		await video.value.play();
		if (id === requestId) onVideoReady();
	} catch (reason: any) {
		if (id !== requestId) return;
		stopStream();
		const messages: Record<string, string> = {
			NotAllowedError: '摄像头权限未开启，请在浏览器地址栏的网站权限中允许使用相机后重试。',
			NotFoundError: '未检测到摄像头，请连接摄像头或返回选择已有照片。',
			NotReadableError: '摄像头被其他程序占用或无法启动，请关闭占用相机的程序后重试。',
			OverconstrainedError: '该摄像头不支持当前拍摄设置，请切换摄像头或选择已有照片。',
		};
		error.value = messages[reason?.name] || '无法开启摄像头，请检查设备及网站权限后重试。';
	} finally { if (id === requestId) starting.value = false; }
}
async function openCamera() {
	if (props.disabled || !props.active) return;
	visible.value = true;
	await nextTick();
	await startCamera();
}
function switchCamera() { facing = facing === 'environment' ? 'user' : 'environment'; void startCamera(); }
async function takePhoto() {
	const element = video.value;
	if (!element || !ready.value || capturing.value || !element.videoWidth || !element.videoHeight) return;
	const id = requestId;
	capturing.value = true;
	try {
		const canvas = document.createElement('canvas');
		const scale = Math.min(1, 2560 / Math.max(element.videoWidth, element.videoHeight));
		canvas.width = Math.round(element.videoWidth * scale);
		canvas.height = Math.round(element.videoHeight * scale);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('无法生成照片');
		context.drawImage(element, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
		if (id !== requestId || !visible.value) return;
		if (!blob) throw new Error('无法生成照片');
		const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
		photo = new File([blob], `拍照资料-${stamp}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
		preview.value = URL.createObjectURL(photo);
		stopStream();
	} catch {
		if (id === requestId) error.value = '照片生成失败，请重试拍摄。';
	} finally { if (id === requestId) capturing.value = false; }
}
function confirmPhoto() {
	if (!photo || props.disabled || !props.active) return;
	const raw = photo as UploadRawFile;
	raw.uid = genFileId();
	emit('capture', { name: raw.name, size: raw.size, uid: raw.uid, raw, status: 'ready' });
	close();
}
watch(() => [props.active, props.disabled], () => { if (!props.active || props.disabled) close(); });

onDeactivated(close);
onBeforeUnmount(release);
</script>

<style scoped>
.camera-entry { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 14px; }
.camera-entry > span, .camera-note { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.camera-stage { position: relative; display: grid; place-items: center; min-height: 180px; background: #141c22; border-radius: 8px; overflow: hidden; }
.camera-stage video, .camera-stage img { display: block; width: 100%; max-height: 52vh; object-fit: contain; }
.camera-status { position: absolute; padding: 24px; color: #fff; text-align: center; background: rgba(0, 0, 0, .55); }
.camera-note, .camera-error { margin-top: 14px; }
.camera-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.camera-actions .el-button { margin-left: 0; }
</style>
