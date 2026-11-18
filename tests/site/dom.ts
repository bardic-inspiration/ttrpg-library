// A minimal DOM for rendering Preact components in tests: elements, text,
// attributes, properties, bubbling events, and focus. It holds only what
// Preact's renderer and the components under test use; there is no layout,
// no CSS, and no selectors beyond `getElementById`.

type Listener = (this: FakeNode, event: FakeEvent) => void;

export class FakeEvent {
  target: FakeNode | null = null;
  currentTarget: FakeNode | null = null;
  constructor(
    readonly type: string,
    readonly bubbles = false,
  ) {}
}

class FakeNode {
  parentNode: FakeElement | null = null;
  childNodes: FakeNode[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(
    readonly nodeType: number,
    readonly ownerDocument: FakeDocument | null,
  ) {}

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get nextSibling(): FakeNode | null {
    const siblings = this.parentNode?.childNodes;
    return siblings ? (siblings[siblings.indexOf(this) + 1] ?? null) : null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  insertBefore<T extends FakeNode>(node: T, before: FakeNode | null): T {
    node.remove();
    const at = before ? this.childNodes.indexOf(before) : -1;
    if (at === -1) this.childNodes.push(node);
    else this.childNodes.splice(at, 0, node);
    node.parentNode = this as unknown as FakeElement;
    return node;
  }

  appendChild<T extends FakeNode>(node: T): T {
    return this.insertBefore(node, null);
  }

  removeChild<T extends FakeNode>(node: T): T {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parentNode = null;
    return node;
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
  }

  /** Calls the target's listeners, then its ancestors' if the event bubbles. */
  dispatchEvent(event: FakeEvent): boolean {
    event.target = this;
    for (let node: FakeNode | null = this; node; node = event.bubbles ? node.parentNode : null) {
      event.currentTarget = node;
      for (const listener of node.listeners.get(event.type) ?? []) listener.call(node, event);
    }
    return true;
  }
}

class FakeText extends FakeNode {
  constructor(
    public data: string,
    doc: FakeDocument,
  ) {
    super(3, doc);
  }

  override get textContent(): string {
    return this.data;
  }
}

export class FakeElement extends FakeNode {
  readonly namespaceURI = 'http://www.w3.org/1999/xhtml';
  readonly attributes: { name: string; value: string }[] = [];
  readonly style = { cssText: '', setProperty: () => {} };
  /** Form control state, as properties, which Preact sets directly. */
  value = '';
  checked = false;

  constructor(
    readonly localName: string,
    doc: FakeDocument | null,
  ) {
    super(1, doc);
  }

  get id(): string {
    return this.getAttribute('id') ?? '';
  }

  set id(value: string) {
    this.setAttribute('id', value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.find((a) => a.name === name)?.value ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }

  setAttribute(name: string, value: unknown): void {
    const existing = this.attributes.find((a) => a.name === name);
    if (existing) existing.value = String(value);
    else this.attributes.push({ name, value: String(value) });
  }

  removeAttribute(name: string): void {
    const at = this.attributes.findIndex((a) => a.name === name);
    if (at !== -1) this.attributes.splice(at, 1);
  }

  focus(): void {
    const doc = this.ownerDocument!;
    if (doc.activeElement === this) return;
    if (doc.activeElement !== doc.body) doc.activeElement.blur();
    doc.activeElement = this;
    this.dispatchEvent(new FakeEvent('focus'));
  }

  blur(): void {
    const doc = this.ownerDocument!;
    if (doc.activeElement !== this) return;
    doc.activeElement = doc.body;
    this.dispatchEvent(new FakeEvent('blur'));
  }
}

export class FakeDocument extends FakeNode {
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  activeElement: FakeElement;

  constructor() {
    super(9, null);
    this.documentElement = this.appendChild(new FakeElement('html', this));
    this.body = this.documentElement.appendChild(new FakeElement('body', this));
    this.activeElement = this.body;
  }

  createElementNS(_namespace: string, name: string): FakeElement {
    return new FakeElement(name, this);
  }

  createElement(name: string): FakeElement {
    return new FakeElement(name, this);
  }

  createTextNode(data: string): FakeText {
    return new FakeText(String(data), this);
  }

  getElementById(id: string): FakeElement | null {
    const walk = (node: FakeNode): FakeElement | null => {
      if (node instanceof FakeElement && node.id === id) return node;
      for (const child of node.childNodes) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  }
}

/** Types at the end of a text input's value, firing one `input`, as one keystroke does. */
export function typeInto(input: FakeElement, text: string): void {
  input.value += text;
  input.dispatchEvent(new FakeEvent('input', true));
}

/** Replaces a text input's whole value, as selecting it and typing or deleting does, firing one `input`. */
export function replaceValue(input: FakeElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new FakeEvent('input', true));
}
