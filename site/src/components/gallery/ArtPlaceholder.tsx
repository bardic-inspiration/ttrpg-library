// The art placeholder (SPEC.md §5.6): a 1:1 framed panel with the type's
// label and "Art placeholder", styled from theme tokens. It is decorative, so
// it is hidden from assistive technology.
export default function ArtPlaceholder({ typeLabel }: { typeLabel: string }) {
  return (
    <div class="art-placeholder" aria-hidden="true">
      <span class="art-placeholder__type">{typeLabel}</span>
      <span class="art-placeholder__note">Art placeholder</span>
    </div>
  );
}
