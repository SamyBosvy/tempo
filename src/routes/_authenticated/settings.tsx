import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: z.object({ google: z.string().optional(), google_error: z.string().optional() }),
  component: Outlet,
});
