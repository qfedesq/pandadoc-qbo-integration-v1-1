import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

execFileSync("npm", ["version", "minor", "--no-git-tag-version"], {
  stdio: "inherit",
});

const packageJsonPath = new URL("../package.json", import.meta.url);
const packageLockPath = new URL("../package-lock.json", import.meta.url);
const readmePath = new URL("../README.md", import.meta.url);

const packageJson = JSON.parse(
  readFileSync(packageJsonPath, "utf8"),
);
const packageLock = JSON.parse(
  readFileSync(packageLockPath, "utf8"),
);
let readme = readFileSync(readmePath, "utf8");

const [major = "0", minor = "0"] = packageJson.version.split(".");
const displayVersion = `V${major}.${minor}`;
const versionedName = `pandadoc-qbo-integration-v${major}-${minor}`;

packageJson.name = versionedName;
packageLock.name = versionedName;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].name = versionedName;
}

readme = readme
  .replace(/^# .+$/m, `# pandadoc-qbo-integration v${major}.${minor}`)
  .replace(
    /- `V\d+\.\d+`/m,
    `- \`${displayVersion}\``,
  )
  .replace(
    /- repository target name: `[^`]+`/m,
    `- repository target name: \`${versionedName}\``,
  )
  .replace(
    /- this repo starts at `\d+\.\d+\.\d+`, displayed as `V\d+\.\d+`/m,
    `- this repo is currently at \`${packageJson.version}\`, displayed as \`${displayVersion}\``,
  );

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
writeFileSync(readmePath, readme);

const packageJsonOutput = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

console.log(`semver=${packageJsonOutput.version}`);
console.log(`display=${displayVersion}`);
console.log(`repo=${versionedName}`);
