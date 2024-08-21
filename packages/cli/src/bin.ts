#!/usr/bin/env node
import { run } from "@drizzle-team/brocli";
import { push } from "./commands/push";
require("esbuild-register");

run([push]);
