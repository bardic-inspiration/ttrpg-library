import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// SPEC.md §8.1 (Requests as GitHub Issues), §12.4; issue #62.
const ROOT = join(import.meta.dirname, '..');
const DIR = join(ROOT, '.github/ISSUE_TEMPLATE');

interface Field {
  type: string;
  id?: string;
  attributes: { label?: string; options?: string[] };
  validations?: { required?: boolean };
}
interface Form {
  name: string;
  description: string;
  labels: string[];
  body: Field[];
}

const load = async (file: string): Promise<Form> => parse(await readFile(join(DIR, file), 'utf8'));
const field = (form: Form, label: string): Field => {
  const found = form.body.find((f) => f.attributes.label === label);
  if (!found) throw new Error(`no field labelled ${label}`);
  return found;
};
const inputs = (form: Form) => form.body.filter((f) => f.type !== 'markdown');

describe('content-request.yml', () => {
  it('adds the request label', async () => {
    const form = await load('content-request.yml');
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    expect(form.labels).toEqual(['request']);
  });

  it('has the §8.1 fields, kinds, and required flags', async () => {
    const form = await load('content-request.yml');
    const shape = inputs(form).map((f) => [f.attributes.label, f.type, f.validations?.required ?? false]);
    expect(shape).toEqual([
      ['Type', 'dropdown', true],
      ['Count', 'dropdown', false],
      ['Brief', 'textarea', true],
      ['Tags', 'textarea', false],
      ['Ruleset', 'input', false],
    ]);
  });

  it('offers exactly the registered type ids', async () => {
    const form = await load('content-request.yml');
    const registry = JSON.parse(await readFile(join(ROOT, 'config/types.json'), 'utf8')) as Record<
      string,
      { types: Record<string, unknown> }
    >;
    const ids = [...new Set(Object.values(registry).flatMap((r) => Object.keys(r.types)))];
    expect([...field(form, 'Type').attributes.options!].sort()).toEqual(ids.sort());
  });

  it('limits Count to 1–10', async () => {
    const form = await load('content-request.yml');
    expect(field(form, 'Count').attributes.options).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    );
  });

  it('gives every input a unique id', async () => {
    const ids = inputs(await load('content-request.yml')).map((f) => f.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('revise-request.yml', () => {
  it('adds the revise label', async () => {
    const form = await load('revise-request.yml');
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    expect(form.labels).toEqual(['revise']);
  });

  it('requires entry IDs and an instruction', async () => {
    const form = await load('revise-request.yml');
    const shape = inputs(form).map((f) => [f.attributes.label, f.type, f.validations?.required ?? false, Boolean(f.id)]);
    expect(shape).toEqual([
      ['Entry IDs', 'textarea', true, true],
      ['Instruction', 'textarea', true, true],
    ]);
  });
});

describe('config.yml', () => {
  it('keeps blank issues off', async () => {
    const config = parse(await readFile(join(DIR, 'config.yml'), 'utf8'));
    expect(config.blank_issues_enabled).toBe(false);
  });
});
