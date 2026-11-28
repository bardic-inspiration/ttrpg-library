// A type's key, `<ruleset>/<type>`: the data nests a type in its ruleset, so two rulesets'
// `creature` stay apart (docs/site.md#gallery "Types", docs/export.md#exporter-interface).
export const typeKey = (ruleset: string, type: string): string => `${ruleset}/${type}`;
