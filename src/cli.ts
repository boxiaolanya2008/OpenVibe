#!/usr/bin/env node
process.title = "pi";
process.on("uncaughtException", (error) => {
	console.error("\n[CRASH] Uncaught Exception:");
	console.error(error);
	fs.appendFileSync("crash.log", `[${new Date().toISOString()}] Uncaught Exception:\n${error.stack}\n\n`);
	process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
	console.error("\n[CRASH] Unhandled Rejection at:", promise);
	console.error("Reason:", reason);
	fs.appendFileSync("crash.log", `[${new Date().toISOString()}] Unhandled Rejection:\n${reason}\n\n`);
	process.exit(1);
});

import { setBedrockProviderModule } from "@mariozechner/pi-ai";
import { bedrockProviderModule } from "@mariozechner/pi-ai/bedrock-provider";
import fs from "fs";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { main } from "./main.js";

setGlobalDispatcher(new EnvHttpProxyAgent());
setBedrockProviderModule(bedrockProviderModule);
try {
	main(process.argv.slice(2));
} catch (error) {
	console.error("\n[CRASH] Main function error:");
	console.error(error);
	fs.appendFileSync(
		"crash.log",
		`[${new Date().toISOString()}] Main Error:\n${error instanceof Error ? error.stack : String(error)}\n\n`,
	);
	process.exit(1);
}
