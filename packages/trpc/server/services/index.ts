import { WorkspaceService } from "@repo/services/workspaces";
import { ClerkIdentityService } from "@repo/services/auth/clerk";
import { FormService } from "@repo/services/forms";
import { PublicFormService } from "@repo/services/forms/public";
import { ResponseService } from "@repo/services/forms/responses";

// services will be initialized here and exported for use in the application

export const identityService = new ClerkIdentityService();

export const workspaceService = new WorkspaceService();
export const formService = new FormService();
export const publicFormService = new PublicFormService();
export const responseService = new ResponseService();
