import { createRouter } from "@tanstack/react-router";
import { Route as RootRoute } from "./routes/root";
import { Route as IndexRoute } from "./routes/index";

const routeTree = RootRoute.addChildren([IndexRoute]);

export const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
