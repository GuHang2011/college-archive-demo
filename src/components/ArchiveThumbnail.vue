<template>
  <span :class="{ 'has-preview': url && !failed }">
    <img v-if="url && !failed" :src="url" alt="" loading="lazy" decoding="async" @error="failed = true" />
    <el-icon v-else><Document /></el-icon>
  </span>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { Document } from '@element-plus/icons-vue';
const props = defineProps<{ blob: Blob }>();
const url = ref(''), failed = ref(false);
function release() { if (url.value) URL.revokeObjectURL(url.value); url.value = ''; }
watch(() => props.blob, blob => {
  release(); failed.value = false;
  if (blob && ['image/png', 'image/jpeg'].includes(blob.type)) url.value = URL.createObjectURL(blob);
}, { immediate: true });
onBeforeUnmount(release);
</script>
