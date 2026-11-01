// The browser side of PNG export (SPEC.md §10.3): clones the detail page's
// capture source (components/detail/CaptureSource.astro) into an off-screen
// host at the requested CSS width, waits for fonts and art, and captures it
// with html-to-image, which embeds the self-hosted fonts it uses.
import { toBlob } from 'html-to-image';
import type { CaptureRequest } from '../exporters/types.ts';

export async function captureEntry({ id, width, scale }: CaptureRequest): Promise<Blob> {
  const source = document.querySelector<HTMLTemplateElement>(`template[data-capture="${CSS.escape(id)}"]`);
  const host = document.createElement('div');
  host.className = 'capture-host';
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  if (source) host.append(source.content.cloneNode(true));
  const node = host.querySelector<HTMLElement>('.capture');
  if (!node) throw new Error(`No capture source for "${id}"`);
  node.style.inlineSize = `${width}px`;
  document.body.append(host);
  try {
    await document.fonts.ready;
    await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
    const blob = await toBlob(node, { pixelRatio: scale, width, height: node.offsetHeight });
    if (!blob) throw new Error(`Capturing "${id}" produced no image`);
    return blob;
  } finally {
    host.remove();
  }
}
