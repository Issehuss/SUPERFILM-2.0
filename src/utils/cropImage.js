export default function getCroppedImg(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = cropPixels.width;
      canvas.height = cropPixels.height;

      ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          // Return both the raw blob (for upload) and a preview URL (for UI if needed)
          resolve({ blob, previewUrl: URL.createObjectURL(blob) });
        },
        "image/jpeg",
        0.92
      );
    };

    image.onerror = () => {
      reject(new Error("Failed to load image"));
    };
  });
}
