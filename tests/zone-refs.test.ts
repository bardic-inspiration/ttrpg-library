// Refs that name a map's zone (docs/content-model.md#references): a ref object's `zone` and a
// `{ref:map/<id>#<zone-id>}` token resolve against the map's zones, link both ways with the zone,
// and render "Map › Zone" linked to the zone's anchor on the map's page.
import { describe, expect, it } from 'vitest';
import { linkEntries, parseRefToken, textRefs, type RefEntry } from '../scripts/validate/refs.ts';
import { linkNames } from '../site/src/exporters/io.ts';
import { genericLines } from '../site/src/lib/generic.ts';
import { entryNames, refTargets, type LoadedEntry } from '../site/src/lib/library.ts';
import { renderInlineMarkdown } from '../site/src/lib/markdown.ts';
import { groupRefs, refOrTextName, zoneRefs } from '../site/src/lib/refs.ts';
import { ruleset } from '../rulesets/dnd-5e-2024/index.ts';

const RULESET = 'dnd-5e-2024';
const zones = [
  { id: 'sluice-gate', name: 'Sluice Gate' },
  { id: 'drowned-shrine', name: 'Drowned Shrine' },
];
const entry = (type: string, id: string, stats: unknown, description?: string): RefEntry => ({
  file: `content/${RULESET}/${type}/${id}.json`,
  ruleset: RULESET,
  type,
  id,
  stats,
  ...(description === undefined ? {} : { description }),
});
const cistern = entry('map', 'sunken-cistern', { scale: 'dungeon', zones });
const spell = entry('spell', 'frost-lance', { effect: 'Cold.' });

describe('zone refs in the validator', () => {
  it('parses a token with a zone, and rejects a malformed zone', () => {
    expect(parseRefToken('map/sunken-cistern#sluice-gate')).toEqual({ key: 'map/sunken-cistern#sluice-gate' });
    expect(parseRefToken('map/sunken-cistern#sluice-gate The Gate')).toEqual({ key: 'map/sunken-cistern#sluice-gate', text: 'The Gate' });
    expect(parseRefToken('map/sunken-cistern#')).toBeUndefined();
    expect(parseRefToken('map/sunken-cistern#Gate')).toBeUndefined();
    expect(textRefs('In the {ref:map/sunken-cistern#sluice-gate}.', 'description').refs).toEqual([{ path: 'description', ref: 'map/sunken-cistern', zone: 'sluice-gate' }]);
  });

  it('links a zone object and a zone token both ways, with the zone', () => {
    const shrine = entry('map', 'drowned-shrine', { scale: 'room', zones: [{ id: 'altar', name: 'Altar' }], within: { ref: 'map/sunken-cistern', zone: 'drowned-shrine' } });
    const town = entry('map', 'harrowfield', { scale: 'zone', zones: [{ id: 'millside', name: 'Millside' }] }, 'Under it, the {ref:map/sunken-cistern#sluice-gate}.');
    const { links, issues } = linkEntries([cistern, shrine, town]);
    expect(issues).toEqual([]);
    expect(links.get('map/drowned-shrine')!.refs).toEqual([{ path: 'stats.within', key: 'map/sunken-cistern', zone: 'drowned-shrine' }]);
    expect(links.get('map/sunken-cistern')!.refBy).toEqual([
      { path: 'stats.within', key: 'map/drowned-shrine', zone: 'drowned-shrine' },
      { path: 'description', key: 'map/harrowfield', zone: 'sluice-gate' },
    ]);
  });

  it('fails a zone the map lacks, and a zone of a target that has none, like a missing ref', () => {
    const lost = entry('map', 'harrowfield', { scale: 'zone', zones: [{ id: 'millside', name: 'Millside' }] }, 'The {ref:map/sunken-cistern#boiler-room} and {ref:spell/frost-lance#cold}.');
    const { links, issues } = linkEntries([cistern, spell, lost]);
    expect(issues.map((i) => i.message)).toEqual([
      'description: ref "map/sunken-cistern#boiler-room" does not resolve: map/sunken-cistern has no zone "boiler-room"; name one of its zones (sluice-gate, drowned-shrine)',
      'description: ref "spell/frost-lance#cold" does not resolve: spell/frost-lance has no zones; only a map\'s zones can be named',
    ]);
    expect(links.get('map/harrowfield')!.refs).toEqual([]);
  });

  it('names the zone form when a token with a zone is malformed', () => {
    const town = entry('map', 'harrowfield', { scale: 'zone', zones: [{ id: 'millside', name: 'Millside' }] }, 'The {ref:map/sunken-cistern#Gate}.');
    expect(linkEntries([cistern, town]).issues.map((i) => i.message)).toEqual([
      'description: ref token {ref:map/sunken-cistern#Gate} is malformed; write {ref:<type>/<id>} or {ref:<type>/<id> <text>}, such as {ref:spell/fireball}, and add #<zone-id> to name a map\'s zone',
    ]);
  });

  it('fails a zone of a missing map as a missing ref', () => {
    const { issues } = linkEntries([entry('spell', 'frost-lance', { effect: 'See {ref:map/nowhere#gate}.' })]);
    expect(issues.map((i) => i.message)).toEqual(['stats.effect: ref "map/nowhere#gate" does not resolve: no map has id "nowhere"']);
  });
});

describe('zone refs on the site', () => {
  const loaded = (type: string, id: string, name: string, stats: unknown): LoadedEntry => ({
    entry: { ruleset: RULESET, author: 'bardic-inspiration', type, id, name, summary: '', stats, meta: { createdAt: '2026-11-27', source: { kind: 'manual' } } },
    derived: {},
    refs: [],
    refBy: [],
  });
  const all = [loaded('map', 'sunken-cistern', 'Sunken Cistern', { scale: 'dungeon', zones }), loaded('map', 'drowned-shrine', 'Drowned Shrine', { scale: 'room', zones: [{ id: 'altar', name: 'Altar' }] })];
  const names = entryNames(all);
  const targets = refTargets(all);

  it('names a zone "Map › Zone", at its anchor on the map\'s page', () => {
    expect(names.get('map/sunken-cistern#sluice-gate')).toBe('Sunken Cistern › Sluice Gate');
    expect(targets.get('map/sunken-cistern#drowned-shrine')).toEqual({ type: 'map', name: 'Sunken Cistern › Drowned Shrine', path: 'dnd-5e-2024/map/sunken-cistern/#zone-drowned-shrine', official: false });
  });

  it('renders a zone token and a zone ref object as "Map › Zone" linked to the zone', () => {
    const html = renderInlineMarkdown('Past the {ref:map/sunken-cistern#sluice-gate}.', { names, ruleset: RULESET });
    expect(html).toMatch(/<a class="ref-link" href="[^"]*dnd-5e-2024\/map\/sunken-cistern\/#zone-sluice-gate">Sunken Cistern › Sluice Gate<\/a>/);
    const within = { ref: 'map/sunken-cistern', zone: 'drowned-shrine' };
    expect(refOrTextName(within, names)).toBe('Sunken Cistern › Drowned Shrine');
    expect(genericLines({ within }, names)).toEqual([{ label: 'Within', value: '{ref:map/sunken-cistern#drowned-shrine}', markdown: true }]);
    expect(linkNames([{ key: 'map/sunken-cistern', zone: 'drowned-shrine' }], names)).toEqual({
      'map/sunken-cistern': 'Sunken Cistern',
      'map/sunken-cistern#drowned-shrine': 'Sunken Cistern › Drowned Shrine',
    });
  });

  it('labels a child map\'s link "Within: Map › Zone", and the parent\'s back-link the child', () => {
    const labels = ruleset.refLabels.bind(ruleset);
    const link = { path: 'stats.within', key: 'map/sunken-cistern', zone: 'drowned-shrine' };
    expect(groupRefs('map', [link], [], targets, labels).forward).toEqual([{ label: 'Within', targets: [targets.get('map/sunken-cistern#drowned-shrine')] }]);
    const back = { path: 'stats.within', key: 'map/drowned-shrine', zone: 'drowned-shrine' };
    expect(groupRefs('map', [], [back], targets, labels).back).toEqual([{ label: 'Child maps', targets: [targets.get('map/drowned-shrine')] }]);
  });

  it('groups a map\'s back-links by zone, in zone order', () => {
    const labels = ruleset.refLabels.bind(ruleset);
    const refBy = [
      { path: 'stats.within', key: 'map/drowned-shrine', zone: 'drowned-shrine' },
      { path: 'description', key: 'map/drowned-shrine' },
    ];
    expect(zoneRefs(['sluice-gate', 'drowned-shrine'], refBy, targets, labels)).toEqual([
      { zone: 'sluice-gate', groups: [] },
      { zone: 'drowned-shrine', groups: [{ label: 'Child maps', targets: [targets.get('map/drowned-shrine')] }] },
    ]);
  });
});
