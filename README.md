Project progression

- Initially just 1 js file, HTML file, and CSS file
- Decided ts was way better than js so switched and used tsc watch to live compile my typescript
- Single TS file became too large so I split it up into modules.
- Installed zod for data validation in TS, but now I needed some way to bundle that with all my ts files. (tsc only compiles each file down to separate js files, which worked fine initially but now I have like 5 ts files and an entire massive library of external files. _cough_ node*modules \_cough, cough*)
- Used tsify and watchify, which worked for a bit (somehow) even though tsify uses browserify under the hood and browserify appears to be a really outdated package that doesn't even support ES6 (ah wait might've been the fact that I was importing as "./api.js" rather than "./api") (Wait that's even more weird cuz my files are originally in ts!?) right I have no clue.
- Chat GPT suggests webpack + ts-loader, but then also introduces webpack-dev-server, which requires webpack-cli but somehow is looking for a part of webpack-cli that doesn't exist in the latest version. (the command `webpack-dev-server --open --mode development` seems to be half a hallucination, given that Google returns a whopping 8 results when searching for that specific command.)

```
> spotify-stats@1.0.0 start
> webpack-dev-server --open --mode development

CLI for webpack must be installed.
  webpack-cli (https://github.com/webpack/webpack-cli)

We will use "npm" to install the CLI via "npm install -D webpack-cli".
Do you want to install 'webpack-cli' (yes/no): yes
Installing 'webpack-cli' (running 'npm install -D webpack-cli')...

up to date, audited 318 packages in 829ms

47 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
Error: Cannot find module 'webpack-cli/package.json'
Require stack:
- /Users/work/node_modules/webpack-dev-server/bin/webpack-dev-server.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1077:15)
    at Function.resolve (node:internal/modules/cjs/helpers:127:19)
    at runCli (/Users/work/node_modules/webpack-dev-server/bin/webpack-dev-server.js:85:27)
    at /Users/work/node_modules/webpack-dev-server/bin/webpack-dev-server.js:190:9
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    '/Users/work/node_modules/webpack-dev-server/bin/webpack-dev-server.js'
  ]
}
```

- So I just looked up the documentation and it said to do `npx webpack serve`, which works flawlessly with live reload. aaaaahh this is the stuff. I won't trust GPT with my life. Plz don't use this as evidence of treason in 20 years when AI takes over the world, thanks.
