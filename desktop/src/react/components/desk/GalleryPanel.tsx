/**
 * GalleryPanel — 插件生成图片画廊（简化版）
 */

import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../stores';
import { hanaFetch } from '../../hooks/use-hana-fetch';

interface GalleryImage {
  name: string;
  path: string;
  mtime: string;
  size: number;
}

export function GalleryPanel() {
  const deskBasePath = useStore(state => state.deskBasePath);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const t = window.t ?? ((key: string) => key);

  const loadGallery = useCallback(async () => {
    if (!deskBasePath) return;
    setLoading(true);
    try {
      const galleryPath = deskBasePath + '/gallery';
      const res = await hanaFetch(`/api/desk/files?path=${encodeURIComponent(galleryPath)}`);
      const data = await res.json();
      const list = Array.isArray(data.files)
        ? data.files.filter((f: { name?: string }) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name || ''))
        : [];
      setImages(list);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [deskBasePath]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  if (!deskBasePath) {
    return <div className="gallery-empty">{t('desk.noDeskRoot') || 'No desk root'}</div>;
  }

  return (
    <div className="gallery-panel">
      <div className="gallery-header">
        <span className="gallery-title">{t('desk.gallery') || 'Gallery'}</span>
        <button className="gallery-refresh-btn" onClick={loadGallery} disabled={loading}>
          ↻
        </button>
      </div>
      {images.length === 0 ? (
        <div className="gallery-empty">{t('desk.galleryEmpty') || 'No images yet'}</div>
      ) : (
        <div className="gallery-grid">
          {images.map(img => (
            <div key={img.path} className="gallery-item">
              <img
                src={`/api/desk/file?path=${encodeURIComponent(img.path)}`}
                alt={img.name}
                className="gallery-thumb"
                onClick={() => window.platform?.showInFinder?.(img.path)}
                title={img.name}
              />
              <span className="gallery-name">{img.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
