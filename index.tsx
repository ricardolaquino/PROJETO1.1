import { createRoute } from "@tanstack/react-router";
import { Route as RootRoute } from "./root";
import PlantaEditor from "@/components/PlantaEditor";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: PlantaEditor,
});
