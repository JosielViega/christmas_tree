import { calculateCoverCrop, decodeGiftPhoto, DEFAULT_GIFT_PHOTO_MAX_BYTES, GiftPhotoError } from './giftTextures';

export const MEMORY_IMAGE_SIZE = 1024;

export const prepareMemoryImage = async (file: File): Promise<File> => {
  const decoded = await decodeGiftPhoto(file, DEFAULT_GIFT_PHOTO_MAX_BYTES);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = MEMORY_IMAGE_SIZE;
    canvas.height = MEMORY_IMAGE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new GiftPhotoError('O navegador não conseguiu preparar a fotografia.');
    context.fillStyle = '#f8f5eb';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const crop = calculateCoverCrop(decoded.width, decoded.height, canvas.width, canvas.height);
    context.drawImage(decoded.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob || blob.size < 1) throw new GiftPhotoError('O navegador não conseguiu otimizar a fotografia.');
    return new File([blob], 'memory.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    decoded.dispose();
  }
};
