// @ts-nocheck
import { COVER_GALLERY_PRESETS, type CoverGalleryPreset } from '../../../shared/cover-gallery-presets.js';

// In Node.js, we can't import .jpg files directly (that's a Vite feature).
// Instead, we just use the path strings directly.
const ASSETS_BASE = '/assets/cover-gallery';

const COVER_GALLERY_IMAGE_URLS: Record<string, string> = {
  'bamboo-shadow-minimal': `${ASSETS_BASE}/bamboo-shadow-minimal.jpg`,
  'blue-sky-screenprint': `${ASSETS_BASE}/blue-sky-screenprint.jpg`,
  'blue-island-watercolor': `${ASSETS_BASE}/blue-island-watercolor.jpg`,
  'felt-blue-storybook': `${ASSETS_BASE}/felt-blue-storybook.jpg`,
  'four-seasons-storybook': `${ASSETS_BASE}/four-seasons-storybook.jpg`,
  'grass-horizon-dream': `${ASSETS_BASE}/grass-horizon-dream.jpg`,
  'green-plain-clouds': `${ASSETS_BASE}/green-plain-clouds.jpg`,
  'hidden-ragdoll-cat': `${ASSETS_BASE}/hidden-ragdoll-cat.jpg`,
  'indigo-window-silhouette': `${ASSETS_BASE}/indigo-window-silhouette.jpg`,
  'maximalist-four-seasons': `${ASSETS_BASE}/maximalist-four-seasons.jpg`,
  'nature-plate-print': `${ASSETS_BASE}/nature-plate-print.jpg`,
  'pastel-spring-bookmark': `${ASSETS_BASE}/pastel-spring-bookmark.jpg`,
  'pink-flower-fisherman': `${ASSETS_BASE}/pink-flower-fisherman.jpg`,
  'scribble-black-cat': `${ASSETS_BASE}/scribble-black-cat.jpg`,
  'spring-gauze-room': `${ASSETS_BASE}/spring-gauze-room.jpg`,
  'story-garden-objects': `${ASSETS_BASE}/story-garden-objects.jpg`,
  'summer-sea-fantasy': `${ASSETS_BASE}/summer-sea-fantasy.jpg`,
  'sunlit-window-leaves': `${ASSETS_BASE}/sunlit-window-leaves.jpg`,
  'rainy-street-cafe': `${ASSETS_BASE}/rainy-street-cafe.jpg`,
  'dragon-pillar-palace': `${ASSETS_BASE}/dragon-pillar-palace.jpg`,
  'wasteland-rider': `${ASSETS_BASE}/wasteland-rider.jpg`,
  'white-cat-blossom': `${ASSETS_BASE}/white-cat-blossom.jpg`,
  'tree-lined-path': `${ASSETS_BASE}/tree-lined-path.jpg`,
  'ochre-silhouette': `${ASSETS_BASE}/ochre-silhouette.jpg`,
  'misty-blossoms': `${ASSETS_BASE}/misty-blossoms.jpg`,
} satisfies Record<string, string>;

export interface CoverGalleryItem extends CoverGalleryPreset {
  src: string;
}

export const COVER_GALLERY_ITEMS: CoverGalleryItem[] = Array.from(COVER_GALLERY_PRESETS, (preset) => {
  const src = COVER_GALLERY_IMAGE_URLS[preset.id];
  if (!src) {
    throw new Error(`Missing cover gallery asset import for preset: ${preset.id}`);
  }
  return { ...preset, src };
});

export function resolveCoverGalleryPresetImagePath(presetId: string): string | undefined {
  return COVER_GALLERY_IMAGE_URLS[presetId];
}
