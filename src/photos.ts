export type Photo = { id: string; title: string; alt: string; author: string; source: string; width: number; height: number };

// Fixed photographs, selected from the Picsum catalogue and credited to their Unsplash authors.
// Paths remain relative so GitHub Pages project subpaths work without remote image requests.
export const photos: Photo[] = [
  { id: 'book-pages', title: '书页与文献', alt: '展开的书籍铺在桌面上，书页呈自然的米白与暖棕色', author: 'Patrick Tomasso', source: 'https://unsplash.com/photos/Oaqk7qqNh_c', width: 1200, height: 800 },
  { id: 'reading', title: '阅读与整理', alt: '木桌上摊开的一本书，近处书页清晰，远处柔和虚化', author: 'Alejandro Escamilla', source: 'https://unsplash.com/photos/cZhUxIQjILg', width: 1200, height: 446 },
  { id: 'field-notes', title: '桌面与记录', alt: '木质桌面上的笔记本电脑、相机、手写笔记和笔', author: 'Galymzhan Abdugalimov', source: 'https://unsplash.com/photos/ICW6QYOcdlg', width: 1200, height: 800 },
];
export const photoUrl = (photo: Photo, thumbnail = false) => `${import.meta.env.BASE_URL}photos/${photo.id}${thumbnail ? '-thumb.webp' : '.jpg'}`;
