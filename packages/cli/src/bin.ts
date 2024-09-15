#!/usr/bin/env node
import { run } from "@drizzle-team/brocli";
import { push } from "./commands/push";
import { generate } from "./commands/generate";
import { migrate } from "./commands/migrate";
import { pull } from "./commands/pull";
require("esbuild-register");

run([push, generate, migrate, pull]);
