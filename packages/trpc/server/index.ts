import { workspacesRouter } from "./routes/workspaces/route";
import { router } from "./trpc";
import { formsRouter } from "./routes/forms/route";
import { healthRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";
import { publicRouter } from "./routes/public/route";
import { membersRouter } from "./routes/members/route";

export const serverRouter = router({
  health: healthRouter,
  workspaces: workspacesRouter,
  forms: formsRouter,
  auth: authRouter,
  public: publicRouter,
  members: membersRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
