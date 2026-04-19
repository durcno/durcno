import esbuild from "esbuild";
import chalk from "chalk";
import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };

const { green } = chalk;

const program = new Command();
program
  .option("--watch", "Watch for changes and rebuild automatically")
  .option("--dest <path>", "Output file destination", "dist/bin.cjs");

program.parse(process.argv);
const options = program.opts();

(async () => {
  const ctx = await esbuild.context({
    entryPoints: ["src/cli/index.ts"],
    outfile: options.dest,
    platform: "node",
    format: "cjs",
    bundle: true,
    sourcemap: options.watch,
    external: ["durcno"],
    define: {
      "process.env.VERSION": JSON.stringify(pkg.version),
    },
  });

  if (options.watch) {
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    const start = Date.now();
    await ctx.rebuild();
    await ctx.dispose();
    const duration = Date.now() - start;
    console.log(
      `${green("✔")} Build complete in ${green(duration)}${green("ms")}`,
    );
  }
})();
