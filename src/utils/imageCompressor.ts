/**
 * 写真圧縮・リサイズユーティリティ
 * - 解析用（AI / OCR）: 銘板・刻印・型番の極小文字を潰さない高解像度（最大1600px, 90%画質）
 * - 保存用（DB / サムネイル）: IndexedDB / Firestore に最適な軽量サイズ（最大400px, 70%画質）
 */
export class ImageCompressor {
  /**
   * AI画像解析・高精度OCR専用の鮮明な画像（微細な型番文字を保持）
   */
  static async compressForAnalysis(
    base64OrFile: string | File,
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.9
  ): Promise<string> {
    return this.compressImage(base64OrFile, maxWidth, maxHeight, quality);
  }

  /**
   * データベース保存用の軽量サムネイル
   */
  static async compressForThumbnail(
    base64OrFile: string | File,
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.7
  ): Promise<string> {
    return this.compressImage(base64OrFile, maxWidth, maxHeight, quality);
  }

  static async compressImage(
    base64OrFile: string | File,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85
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
