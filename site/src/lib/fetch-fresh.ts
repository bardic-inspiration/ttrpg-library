// Every data fetch on the site goes through here (SPEC.md §9.1). `no-cache`
// makes the browser revalidate its cached copy with the server before using
// it, so a deploy shows up on the next load instead of after the cached copy
// expires. An unchanged file costs only a 304.

export const fetchFresh = (url: string): Promise<Response> => fetch(url, { cache: 'no-cache' });
