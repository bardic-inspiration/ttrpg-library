// Print and Download (docs/export.md#controls): what each exporting place shows.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import ExportControls from '../../site/src/components/detail/ExportControls.tsx';
import ExportButtons from '../../site/src/components/export/ExportButtons.tsx';
import PagePrint from '../../site/src/components/export/PagePrint.astro';
import { configuredControls, controlsFor, modules } from '../../site/src/exporters/index.ts';
import { isPageType } from '../../site/src/lib/library.ts';
import { fixtureLibrary } from './library-fixtures.ts';

const lib = await fixtureLibrary();
const BASE = '/ttrpg-library/';
const ids = (exporters: { id: string }[]) => exporters.map((e) => e.id);
const formats = (html: string) => [...html.matchAll(/class="export-buttons__format">([^<]+)</g)].map((m) => m[1]);
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)/g)].map((m) => m[1]);

describe('export controls (docs/export.md#controls)', () => {
  it('splits exporters into Print and Download\'s formats', () => {
    const entry = configuredControls('entry');
    expect(entry.print?.id).toBe('print');
    expect(ids(entry.downloads)).toEqual(['png', 'json']);
    expect(entry.downloads.map((e) => e.label)).toEqual(['PNG', 'JSON']);
  });

  it('offers a set JSON and no PNG', () => {
    const set = configuredControls('set');
    expect(set.print?.id).toBe('print');
    expect(ids(set.downloads)).toEqual(['json']);
  });

  it('leaves Download out on request', () => {
    expect(configuredControls('entry', { download: false })).toEqual({ print: modules.print, downloads: [] });
    expect(controlsFor([modules.json!])).toEqual({ print: undefined, downloads: [modules.json] });
  });

  it('marks every exporter as Print or a Download format', () => {
    for (const exporter of Object.values(modules)) expect(['print', 'download']).toContain(exporter.kind);
  });
});

describe('the detail page\'s controls', () => {
  const render = (id: string, page = false) => {
    const { entry, derived } = lib.byId(id);
    return renderToString(h(ExportControls, { item: { entry, derived }, base: BASE, page, ready: true }));
  };

  it('shows only Print and Download on a card entry, with the menu closed', () => {
    const html = render('cinder-hound');
    expect(buttons(html).slice(0, 2)).toEqual(['Print', 'Download']);
    expect(html).toMatch(/aria-expanded="false"[^>]*aria-controls="export-formats-cinder-hound"/);
    expect(html).toMatch(/<ul id="export-formats-cinder-hound"[^>]*hidden/);
    expect(formats(html)).toEqual(['PNG', 'JSON']);
    expect(html).toContain('role="status"');
  });

  it('shows Print and no Download on a page type', () => {
    const html = render('sorcerer', true);
    expect(buttons(html)).toEqual(['Print']);
    expect(html).not.toContain('export-buttons__menu');
  });

  it('renders nothing before it hydrates', () => {
    const { entry, derived } = lib.byId('cinder-hound');
    expect(renderToString(h(ExportControls, { item: { entry, derived }, base: BASE }))).toBe('');
  });
});

describe('the Download menu', () => {
  it('opens to list its formats', () => {
    const html = renderToString(h(ExportButtons, { controls: configuredControls('entry'), run: () => {}, menuId: 'm', open: true }));
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).not.toMatch(/<ul id="m"[^>]*hidden/);
    expect(formats(html)).toEqual(['PNG', 'JSON']);
  });

  it('stays closed while the controls are disabled', () => {
    const html = renderToString(h(ExportButtons, { controls: configuredControls('set'), run: () => {}, menuId: 'm', open: true, disabled: true }));
    expect(html).toMatch(/<ul id="m"[^>]*hidden/);
  });
});

describe('page types (docs/content-model.md#components)', () => {
  it('are the types that list components', () => {
    for (const type of ['class', 'subclass', 'species']) expect(isPageType('dnd-5e-2024', type)).toBe(true);
    for (const type of ['spell', 'creature', 'item', 'class-feature']) expect(isPageType('dnd-5e-2024', type)).toBe(false);
  });
});

describe('a rules page\'s Print', () => {
  it('is one Print button, hidden until its script runs', async () => {
    const html = await (await AstroContainer.create()).renderToString(PagePrint);
    expect(html).toMatch(/<ul class="export-buttons"[^>]*data-page-print[^>]*hidden/);
    expect(buttons(html)).toEqual(['Print']);
    expect(html).not.toContain('Download');
  });
});
