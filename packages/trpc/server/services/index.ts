import { WorkspaceService } from "@repo/services/workspaces";
import { ClerkIdentityService } from "@repo/services/auth/clerk";

// services will be initialized here and exported for use in the application

export const identityService = new ClerkIdentityService();

export const workspaceService = new WorkspaceService();
