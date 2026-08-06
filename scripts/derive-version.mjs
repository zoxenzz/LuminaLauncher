// Bakes the numeric version derived from a release/beta tag into the workspace
// so the shipped app version matches the tag. Run by the CI workflow on tag
// pushes (see .github/workflows/lumina-launcher-build.yml).
//
// Usage: node scripts/derive-version.mjs <version>   e.g. 1.2.0
import { readFileSync, writeFileSync } from 'node:fs'

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
	console.error(`[derive-version] invalid version: ${version}`)
	process.exit(1)
}

// JSON configs — targeted replace keeps the rest of the file byte-identical.
for (const file of ['apps/app/tauri.conf.json', 'apps/app-frontend/package.json']) {
	const raw = readFileSync(file, 'utf8')
	if (!/"version":\s*"[^"]*"/.test(raw)) {
		console.error(`[derive-version] no version field found in ${file}`)
		process.exit(1)
	}
	writeFileSync(file, raw.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`))
}

// Cargo.tomls — only the top-level [package] version sits at column 0 as
// `version = "..."`, so this cannot clobber dependency declarations.
for (const file of ['apps/app/Cargo.toml', 'packages/app-lib/Cargo.toml']) {
	writeFileSync(file, readFileSync(file, 'utf8').replace(/^version = ".*"/m, `version = "${version}"`))
}

// Cargo.lock — keep theseus/theseus_gui in sync so the build doesn't silently
// rewrite the lockfile during CI.
const lockPath = 'Cargo.lock'
const lock = readFileSync(lockPath, 'utf8')
const updated = lock
	.split(/\n(?=\[\[package\]\])/)
	.map((block) => {
		if (/name = "(theseus|theseus_gui)"/.test(block)) {
			return block.replace(/^version = ".*"/m, `version = "${version}"`)
		}
		return block
	})
	.join('\n')
writeFileSync(lockPath, updated)

console.log(`[derive-version] set workspace version to ${version}`)
