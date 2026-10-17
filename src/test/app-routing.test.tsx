import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each(['day', 'focus', 'breathing', 'calendar', 'notifications', 'account', 'data', 'about'])('matches Settings %s under the authenticated Settings layout', (page) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes(`/settings/${page}`);
    expect(matches.at(-1)?.routeId).toBe(`/_authenticated/settings/${page}`);
    expect(matches.map(match => match.routeId)).toContain('/_authenticated');
    expect(matches.map(match => match.routeId)).toContain('/_authenticated/settings');
  });
  it('matches the Settings menu rather than only its layout', () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes('/settings').at(-1)?.routeId).toBe('/_authenticated/settings/');
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
