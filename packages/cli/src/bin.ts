#!/usr/bin/env node
require("esbuild-register");
import { run } from "@drizzle-team/brocli";
import { apply } from "./commands/apply";

run([apply]);
