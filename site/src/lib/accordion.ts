// Accordion pages (docs/site.md#accordion-pages): the ids of sections that aren't a primitive or
// a component, the table of contents' items, and the step that opens the accordions around a
// link's target.

/** One table-of-contents line: a link to a section's id, with the sections nested in it. */
export interface TocItem {
  id: string;
  label: string;
  children?: TocItem[];
}

/**
 * The anchor of a titled section that isn't a primitive, group, or component: `section-<slug>`.
 * The prefix keeps it apart from the `<type>-<id>` anchors.
 */
export const sectionId = (title: string): string =>
  `section-${title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;

/** The parts of an element `openAround` reads, so it runs on a stand-in outside a browser. */
interface Node {
  tagName: string;
  open?: boolean;
  parentElement: Node | null;
}

/** Opens the element, when it is an accordion, and every accordion it sits in. */
export function openAround(element: Node | null): void {
  for (let node = element; node; node = node.parentElement) {
    if (node.tagName === 'DETAILS') node.open = true;
  }
}
