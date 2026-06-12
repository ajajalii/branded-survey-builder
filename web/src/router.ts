// src/router.ts
//
// WHY TANSTACK ROUTER?
// The spec mandated it. Compared to React Router v6 it offers:
//   - Full TypeScript inference for route params and search params
//   - Built-in route loaders and pending states
//   - File-based routing (optional, we use code-based here for clarity)
//
// WHY CODE-BASED ROUTING INSTEAD OF FILE-BASED?
// File-based routing (like Next.js) requires a Vite plugin and a specific
// folder convention. Code-based routing is more explicit — every route is
// visible in one file, which is easier to walk through in an interview.

import { RootRoute, Route, Router, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "./lib/auth";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import Root from "./pages/Root";
import SignupPage from "./pages/SignupPage";
import SurveyPage from "./pages/SurveyPage";

// The root route wraps the entire app (renders <Outlet /> for child routes)
const rootRoute = new RootRoute({
  component: Root,
});

// /login
const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

// /signup
const signupRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
});

// /dashboard — protected
// WHY beforeLoad FOR PROTECTION?
// TanStack Router's `beforeLoad` runs before the route component mounts.
// Throwing a redirect here means unauthenticated users are bounced to /login
// before any UI renders — no flash of protected content.
const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});

// Index route — redirect / to /login
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});

export const surveyRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/survey/$slug",
  component: SurveyPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  dashboardRoute,
  surveyRoute,
]);

export const router = new Router({ routeTree });

// Type augmentation required by TanStack Router for full type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
