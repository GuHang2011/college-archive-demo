<template>
  <section class="photo-gallery" :class="{ 'photo-gallery-feature': featured }" aria-label="摄影素材参考">
    <div class="photo-gallery-label"><span>摄影参考</span><span>Unsplash</span></div>
    <div class="photo-gallery-strip">
      <button v-for="photo in displayed" :key="photo.id" class="photo-tile" :aria-label="`查看摄影素材：${photo.title}`" @click="emit('preview', photo)">
        <img :src="photoUrl(photo, true)" :alt="photo.alt" width="480" height="340" :loading="featured ? 'lazy' : 'eager'" decoding="async" />
        <span>{{ photo.title }}<span aria-hidden="true">↗</span></span>
      </button>
    </div>
    <p class="photo-gallery-caption">公开摄影素材 · 仅作场景参考</p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { photos, photoUrl, type Photo } from '../photos';
const props = defineProps<{ featured?: boolean }>();
const emit = defineEmits<{ (e: 'preview', photo: Photo): void }>();
const displayed = computed(() => props.featured ? [photos[2]] : photos);
</script>
