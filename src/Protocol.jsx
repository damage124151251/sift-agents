import React from "react";
import { External } from "./components.jsx";
export default function Protocol() {
  return (
    <div className="protocol">
      <h2>A working team, not a feed of invented events.</h2>
      <p>
        SIFT is a rule-based repository observation service. Its three agents
        share one job: turn changes in public GitHub repositories into readable,
        source-linked reports.
      </p>
      <div className="protocol-stages">
        <section>
          <b>01</b>
          <h3>Pip collects.</h3>
          <p>
            The collector retrieves the latest default-branch commit and
            compares it with the last completed checkpoint. The first run reads
            a baseline of the latest commit only.
          </p>
        </section>
        <section>
          <b>02</b>
          <h3>Dot inspects.</h3>
          <p>
            The inspector classifies changed file paths: interfaces,
            dependencies, workflow automation, documentation and tests.
            Deletions and capped coverage are highlighted for review.
          </p>
        </section>
        <section>
          <b>03</b>
          <h3>Bit publishes.</h3>
          <p>
            The publisher creates a structured report containing the revision,
            source comparison, file metadata and an input SHA-256 checksum.
            Reports are available as Markdown or JSON.
          </p>
        </section>
      </div>
      <h2>What a report means</h2>
      <p>
        SIFT analyzes returned file metadata, not code semantics. It does not
        run repository code, submit pull requests, trade tokens, detect every
        breaking change or certify security. A rule match is a prompt for human
        review. A checksum fingerprints the recorded inputs; it is not an audit
        signature.
      </p>
      <h2>Timing and coverage</h2>
      <p>
        The server checks up to three configured repositories every ten minutes.
        Each request has a timeout and response-size cap. Missing data, rate
        limits and diverged history retain the prior checkpoint. A failed run
        stays blocked; it is not shown as completed.
      </p>
      <p>
        The first baseline reads at most 100 files from the latest commit.
        Comparisons use GitHub's returned file list, capped at 300 files.
        Pagination or a limit-sized response is marked potentially incomplete.
        Multiple commits can be combined in a comparison; the report does not
        assert that every individual commit was inspected.
      </p>
      <p>
        The latest 80 runs, 90 reports and 180 stage events are retained.
        Unchanged revisions generate a check record, not a duplicate report.
        Pause/resume does not erase history. Initial imports and historical
        replay are explicitly labeled.
      </p>
      <h2>Public data and controls</h2>
      <p>
        The workroom, reports and connected repositories are public. Adding
        sources, pausing agents, running a cycle and configuring the token
        watcher require the operator key. Credentials stay in tab memory. Only
        public repositories are accepted; do not add private or sensitive data.
      </p>
      <h2>The token monitor</h2>
      <p>
        The development wallet is configured independently from repository
        sources. The Pump watcher starts at the finalized slot recorded on
        activation. It accepts a token named SIFT only when that wallet signs a
        matching create instruction as user and creator, and the created token
        mint is initialized. Incoming transfers and purchases cannot become the
        CA.
      </p>
      <p>
        The CA remains soon until verified. Changing the monitored wallet starts
        a fresh discovery window. The watcher does not deploy a token or move
        funds. There is no trading or fee-distribution mechanism in SIFT.
      </p>
      <div className="reference-links">
        <External href="https://docs.github.com/en/rest/commits/commits#compare-two-commits">
          GitHub comparison API
        </External>
        <External href="https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json">
          Pump instruction schemas
        </External>
      </div>
      <p className="fineprint">
        Independent, unaudited software. Public source access is not a
        partnership with a monitored repository. Availability and coverage are
        not guaranteed.
      </p>
    </div>
  );
}
