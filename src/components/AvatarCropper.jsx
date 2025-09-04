// AvatarCropper.jsx (updated and working version)
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import Slider from '@mui/material/Slider';

const AvatarCropper = ({ imageSrc, onCancel, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropAreaComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropAndSave = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error('Cropping failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center">
      <div className="bg-zinc-900 p-6 rounded-md shadow-xl text-white max-w-md w-full">
        <div className="relative h-64 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1} // square crop for avatar
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        <div className="mt-4">
          <label className="text-sm">Zoom</label>
          <Slider
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e, z) => setZoom(z)}
            sx={{ color: '#facc15' }}
          />
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleCropAndSave}
            className="px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-300"
          >
            Crop & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropper;
