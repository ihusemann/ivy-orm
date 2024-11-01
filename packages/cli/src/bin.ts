#!/usr/bin/env node
require("esbuild-register");
import { run } from "@drizzle-team/brocli";
import { push } from "./commands/push";
import { migrate } from "./commands/migrate";

run([push, migrate]);
