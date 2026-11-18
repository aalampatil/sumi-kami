import globals from "globals";
import { config } from "./base.js";

export const nodeConfig = [...config, { languageOptions: { globals: globals.node } }];
