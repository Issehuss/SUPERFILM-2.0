// src/components/AvatarCropper.jsx
import React, { useState, useCallback, useMemo } from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/cropImage";
import Slider from "@mui/material/Slider";

/**
 * A configurable cropper for both avatars (round, 1:1) and banners (rect, 16:9).
 *
 * Props:
 *  - imageSrc: string (required)
 *  - onCancel: () => void (required)
 *  - onCropComplete: (dataUrl: string) => void (required)
 *  - variant?: "avatar" | "banner"   // presets; default "avatar"
 *  - aspect?: number                  // override aspect (e.g., 21/9)
 *  - cropShape?: "rect" | "round"     // override crop shape
 *  - initialZoom?: number             // default depends on variant
 *  - minZoom?: number                 // default depends on variant
 *  - maxZoom?: number                 // default depends on variant
 */
const AvatarCropper = ({
  imageSrc,
  onCancel,
  onCropComplete,
  variant = "avatar",
  aspect,
  cropShape,
  initialZoom,
  minZoom,
  maxZoom,
}) => {
  // Sensible defaults by variant
  const defaults = useMemo(() => {
    if (variant === "banner") {
      return {
        aspect: 16 / 9,
        cropShape: "rect",
        initialZoom: 1,
        minZoom: 1,
        maxZoom: 4,
        panelHeightClass: "h-[48vh]", // taller space to feel cinematic
        title: "Crop banner",
      };
    }
    // avatar
    return {
      aspect: 1,
      cropShape: "round",
      initialZoom: 1.2,
      minZoom: 1,
      maxZoom: 3,
      panelHeightClass: "h-64",
      title: "Crop profile picture",
    };
  }, [variant]);

  const effAspect = aspect ?? defaults.aspect;
  const effCropShape = cropShape ?? defaults.cropShape;
  const effInitialZoom = initialZoom ?? defaults.initialZoom;
  const effMinZoom = minZoom ?? defaults.minZoom;
  const effMaxZoom = maxZoom ?? defaults.maxZoom;

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(effInitialZoom);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropAreaComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropAndSave = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error("Cropping failed:", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center">
      <div className="bg-zinc-900 w-[min(92vw,720px)] rounded-2xl shadow-xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="font-semibold text-base">{defaults.title}</h3>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
          >
            Cancel
          </button>
        </div>

        {/* Crop area */}
        <div className={`relative ${defaults.panelHeightClass} bg-black`}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={effAspect}
            cropShape={effCropShape}
            showGrid={false}
            restrictPosition={true}
            zoomWithScroll={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        {/* Controls */}
        <div className="px-5 pb-5 pt-4">
          <label className="text-sm block mb-2">Zoom</label>
          <Slider
            value={zoom}
            min={effMinZoom}
            max={effMaxZoom}
            step={0.05}
            onChange={(_, z) => setZoom(Number(z))}
            sx={{ color: "#facc15" }}
          />

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCropAndSave}
              className="px-4 py-2 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-400"
            >
              Crop & Save
            </button>
          </div>

          {/* Helpful hint */}
          {variant === "banner" && (
            <p className="text-[11px] text-zinc-400 mt-3">
              Tip: Use pinch/scroll to zoom and drag to frame your banner. We
              keep a wide 16:9 aspect for a cinematic look.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarCropper;
