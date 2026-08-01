const AVATAR_EDGE = 512;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode image"));
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not resize image")),
      "image/jpeg",
      0.84,
    );
  });
}

export async function prepareAvatarUpload(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  let image: HTMLImageElement | null = null;
  const canvas = document.createElement("canvas");

  try {
    image = await loadImage(sourceUrl);
    const sourceEdge = Math.min(image.naturalWidth, image.naturalHeight);
    if (!sourceEdge) throw new Error("Empty image");

    const outputEdge = Math.min(AVATAR_EDGE, sourceEdge);
    const sourceX = Math.max(0, (image.naturalWidth - sourceEdge) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceEdge) / 2);
    canvas.width = outputEdge;
    canvas.height = outputEdge;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas is unavailable");
    context.fillStyle = "#f7f2e8";
    context.fillRect(0, 0, outputEdge, outputEdge);
    context.drawImage(image, sourceX, sourceY, sourceEdge, sourceEdge, 0, 0, outputEdge, outputEdge);

    const blob = await canvasBlob(canvas);
    return new File([blob], "profile-photo.jpg", { type: blob.type, lastModified: Date.now() });
  } finally {
    if (image) image.src = "";
    URL.revokeObjectURL(sourceUrl);
    canvas.width = 1;
    canvas.height = 1;
  }
}
