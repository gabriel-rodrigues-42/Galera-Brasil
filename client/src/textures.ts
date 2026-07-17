import * as THREE from 'three';

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A framed placeholder "photo" — an abstract gradient card with a caption,
 * standing in for a real uploaded image until Phase 2 adds real uploads. */
export function makeImagePlaceholderTexture(
  caption: string,
  accentColor: string
): THREE.CanvasTexture {
  return makeCanvasTexture(512, 384, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 384);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(1, '#1c1c22');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 384);

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(380, 90, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, 340);
    ctx.lineTo(200, 180);
    ctx.lineTo(340, 340);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 320, 512, 64);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, 16, 352, 480);
  });
}

/** A wooden plaque texture for text posts. */
export function makePlaqueTexture(title: string, body: string): THREE.CanvasTexture {
  return makeCanvasTexture(512, 320, (ctx) => {
    ctx.fillStyle = '#e9dcc3';
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = '#8a6d46';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 310);

    ctx.fillStyle = '#3d2b1f';
    ctx.font = '700 32px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 32, 64, 448);

    ctx.font = '400 22px system-ui, sans-serif';
    wrapText(ctx, body, 32, 110, 448, 30);
  });
}

/** A glowing label for link-post pedestals. */
export function makeLinkLabelTexture(label: string): THREE.CanvasTexture {
  return makeCanvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = '#12202b';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#7fd8e8';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 80, 480);
  });
}

/** Floating name tag shown above a remote player's avatar. */
export function makeNameTagTexture(name: string, accentColor: string): THREE.CanvasTexture {
  return makeCanvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 8, 256, 48, 12);
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(28, 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 48, 33, 196);
  });
}

/** Short-lived speech bubble shown above an avatar when they send a chat message. */
export function makeChatBubbleTexture(text: string): THREE.CanvasTexture {
  return makeCanvasTexture(384, 96, (ctx) => {
    ctx.fillStyle = 'rgba(244, 241, 232, 0.95)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 376, 80, 14);
    ctx.fill();
    ctx.fillStyle = '#1c1c22';
    ctx.font = '500 22px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    wrapText(ctx, text, 18, 20, 348, 26);
  });
}
