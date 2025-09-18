// components/BannerCropper.jsx
import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';

/**
 * Returns a data URL for the cropped image area.
 * Using data URL ensures it persists reliably (vs. object URLs).
 */
async function getCroppedDataUrl(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = reject;
  });
}

const BannerCropper = ({ imageSrc, aspect = 16 / 9, onCancel, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const handleComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels);
      onCropComplete(dataUrl);
    } catch (e) {
      console.error('Crop failed:', e);
      onCancel?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-[92vw] max-w-4xl h-[70vh] bg-zinc-900 rounded-xl overflow-hidden">
        <div className="absolute inset-0">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleComplete}
            restrictPosition={false}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-black/10 flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
          <button onClick={onCancel} className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-yellow-400 text-black hover:bg-yellow-400 font-semibold"
          >
            Save Crop
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannerCropper;

