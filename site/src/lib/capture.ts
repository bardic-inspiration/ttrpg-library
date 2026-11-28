// The browser side of PNG export (docs/export.md#png): clones the detail page's
// capture source (components/detail/CaptureSource.astro) into an off-screen
// host at the requested CSS width, waits for fonts and art, and captures it
// with html-to-image, which embeds the self-hosted fonts it uses.
import { toBlob } from 'html-to-image';
import type { CaptureRequest } from '../exporters/types.ts';

/** What a map diagram's classes set (site/src/styles/diagram.css): its colors and its labels' font. */
export const DIAGRAM_STYLES = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'text-anchor'] as const;

/**
 * Writes each map diagram shape's computed colors and label font onto it, inline. html-to-image clones an
 * `<svg>` whole and copies only the root's computed style, and the page's stylesheet doesn't reach the
 * image, so a diagram colored by its classes (docs/content-model.md#map-diagrams) would capture black.
 */
export function inlineDiagramStyles(root: ParentNode, styleOf: (element: Element) => Pick<CSSStyleDeclaration, 'getPropertyValue'>): void {
  for (const element of root.querySelectorAll<SVGElement>('svg.diagram *')) {
    const style = styleOf(element);
    for (const property of DIAGRAM_STYLES) element.style.setProperty(property, style.getPropertyValue(property));
  }
}

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
    inlineDiagramStyles(node, (element) => getComputedStyle(element));
    const blob = await toBlob(node, { pixelRatio: scale, width, height: node.offsetHeight });
    if (!blob) throw new Error(`Capturing "${id}" produced no image`);
    return blob;
  } finally {
    host.remove();
  }
}
