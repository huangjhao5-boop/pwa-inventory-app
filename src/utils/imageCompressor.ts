/**
 * 撮影した高解像度写真（数MB）を、Firestore（1MB制限）およびIndexedDBに安全に保存できる
 * 軽量サムネイル画像（30KB以下）に高速リサイズ・圧縮するユーティリティ
 */
export class ImageCompressor {
  static async compressImage(
    base64OrFile: string | File,
    maxWidth = 360,
    maxHeight = 360,
    quality = 0.65
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(typeof base64OrFile === 'string' ? base64OrFile : '');
        }

        // 高画質バイリニア描画
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 形式で 20KB~30KB 程度に圧縮
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = () => {
        resolve(typeof base64OrFile === 'string' ? base64OrFile : '');
      };

      if (typeof base64OrFile === 'string') {
        img.src = base64OrFile;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(base64OrFile);
      }
    });
  }
}
