// The situational-field rule (SPEC.md §5.8), shared by every template.
//
// Required `stats` fields always display, including `0` and `false`. Optional
// fields display only when present: the schema rejects every "none" value
// (`0`, `false`, `""`, `[]`, `{}`) for an optional field, so presence alone says
// whether it applies. Templates decide through these helpers and never test an
// optional field's value against `0`, `false`, or emptiness.

/** Whether an optional field is present, and so displays. */
export const present = <T>(value: T | undefined): value is T => value !== undefined;

/** Formats an optional field when it is present; `undefined` means it doesn't display. */
export const whenPresent = <T, R>(value: T | undefined, format: (value: T) => R): R | undefined =>
  present(value) ? format(value) : undefined;
