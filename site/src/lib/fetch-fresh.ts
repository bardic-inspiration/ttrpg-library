// Every data fetch on the site goes through here (docs/site.md#fresh-data). `no-cache`
// makes the browser revalidate its cached copy with the server before using
// it, so a deploy shows up on the next load instead of after the cached copy
// expires. An unchanged file costs only a 304.

export const fetchFresh = (url: string): Promise<Response> => fetch(url, { cache: 'no-cache' });
