import assert from "node:assert/strict";
import test from "node:test";
import { main } from "../../src/cli.js";

const TMP_CWD = "/nonexistent-cwd-for-argv-tests";

test("no args prints top-level help and exits zero", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:BEH-008
  const result = await main([], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /sdd token/);
  assert.match(result.stdout, /sdd check/);
  assert.match(result.stdout, /sdd refresh/);
});

test("--help prints top-level help and exits zero", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:BEH-008
  const result = await main(["--help"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /--format=json\|human\|yaml/);
});

test("--version prints package version", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:ASM-009
  const result = await main(["--version"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^\d+\.\d+\.\d+\n$/);
});

test("token --help prints subcommand help and exits zero", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:BEH-008
  const result = await main(["token", "--help"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: sdd token/);
});

test("check --help prints subcommand help and exits zero", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:BEH-008
  const result = await main(["check", "--help"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: sdd check/);
});

test("refresh --help prints subcommand help and exits zero", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:BEH-008
  const result = await main(["refresh", "--help"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: sdd refresh/);
});

test("unknown subcommand exits with code 2", async () => {
  // @covers sdd-cli:CTR-001
  // @covers sdd-cli:BEH-008
  const result = await main(["unknown-subcommand"], TMP_CWD);

  assert.equal(result.exitCode, 2);
});

test("token rejects --format=yaml", async () => {
  // @covers sdd-cli:CTR-001
  const result = await main(["token", "--format=yaml"], TMP_CWD);

  assert.equal(result.exitCode, 2);
});

test("check rejects --format=yaml", async () => {
  // @covers sdd-cli:CTR-001
  const result = await main(["check", "--format=yaml"], TMP_CWD);

  assert.equal(result.exitCode, 2);
});

test("token rejects unknown flag", async () => {
  // @covers sdd-cli:CTR-001
  const result = await main(["token", "--bogus"], TMP_CWD);

  assert.equal(result.exitCode, 2);
});

test("token rejects an unknown --format value", async () => {
  // @covers sdd-cli:CTR-001
  const result = await main(["token", "--format=xml"], TMP_CWD);

  assert.equal(result.exitCode, 2);
});

test("lint --help prints subcommand help", async () => {
  // @covers sdd-cli:CTR-008
  const result = await main(["lint", "--help"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: sdd lint/);
});

test("approve --help prints subcommand help", async () => {
  // @covers sdd-cli:CTR-010
  const result = await main(["approve", "--help"], TMP_CWD);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: sdd approve/);
});

test("approve without --id exits 2", async () => {
  // @covers sdd-cli:CTR-010
  const result = await main(
    ["approve", "--approver", "alice", "--owner-role", "tech-lead", "--change-request", "https://x"],
    TMP_CWD,
  );

  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /--id required/);
});

test("approve without --approver exits 2", async () => {
  // @covers sdd-cli:CTR-010
  const result = await main(
    ["approve", "--id", "demo:beh-1", "--owner-role", "tech-lead", "--change-request", "https://x"],
    TMP_CWD,
  );

  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /--approver required/);
});

test("approve without --owner-role exits 2", async () => {
  // @covers sdd-cli:CTR-010
  const result = await main(
    ["approve", "--id", "demo:beh-1", "--approver", "alice", "--change-request", "https://x"],
    TMP_CWD,
  );

  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /--owner-role required/);
});

test("approve without --change-request exits 2", async () => {
  // @covers sdd-cli:CTR-010
  const result = await main(
    ["approve", "--id", "demo:beh-1", "--approver", "alice", "--owner-role", "tech-lead"],
    TMP_CWD,
  );

  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /--change-request required/);
});

test("approve rejects unknown --target-status", async () => {
  // @covers sdd-cli:CTR-010
  const result = await main(
    [
      "approve",
      "--id", "demo:beh-1",
      "--approver", "alice",
      "--owner-role", "tech-lead",
      "--change-request", "https://x",
      "--target-status", "garbage",
    ],
    TMP_CWD,
  );

  assert.equal(result.exitCode, 2);
});

test("lint rejects --format=yaml", async () => {
  // @covers sdd-cli:CTR-008
  const result = await main(["lint", "--format=yaml"], TMP_CWD);

  assert.equal(result.exitCode, 2);
});
