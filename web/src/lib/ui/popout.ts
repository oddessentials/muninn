export const widgetPath = '/widget';
export const widgetWidth = 340;
export const widgetHeight = 600;
export const floatingHeight = 660;

interface PictureInPictureHost {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}

function pictureInPicture(): PictureInPictureHost | null {
  const host = (globalThis as { documentPictureInPicture?: PictureInPictureHost })
    .documentPictureInPicture;
  return host ?? null;
}

function openPopup(url: string): void {
  window.open(url, 'watch', `popup,width=${widgetWidth},height=${widgetHeight}`);
}

async function openFloating(host: PictureInPictureHost, url: string): Promise<boolean> {
  let floating: Window;
  try {
    floating = await host.requestWindow({ width: widgetWidth, height: floatingHeight });
  } catch {
    return false;
  }
  const body = floating.document.body;
  body.style.margin = '0';
  body.style.background = '#121116';
  const frame = floating.document.createElement('iframe');
  frame.src = url;
  frame.title = 'Watch';
  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
  body.append(frame);
  return true;
}

export async function popOutWidget(): Promise<void> {
  const url = new URL(widgetPath, location.href).href;
  const host = pictureInPicture();
  if (host && (await openFloating(host, url))) return;
  openPopup(url);
}
