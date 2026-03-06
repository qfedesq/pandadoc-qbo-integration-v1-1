# PandaDoc First-Meeting Demo Script

## Goal

Frame the product as a strategic PandaDoc extension:

- document workflows are becoming commoditized
- embedded finance creates retention, monetization, and operational lock-in
- invoice factoring is the first high-value workflow to prove that thesis

Do not present this as "a factoring backend" or "a crypto product."
Present it as "working capital embedded directly inside PandaDoc."

## Demo posture

Lead with business value:

1. PandaDoc already sits near the invoice and payment workflow.
2. That position can be extended into capital access.
3. The result is immediate seller value, new revenue for PandaDoc, and deeper product dependency.

Keep Protofire in a supporting role:

- "Built with Protofire"
- not "Protofire product"
- not "Protofire marketplace"

## What to emphasize

Use these phrases repeatedly:

- `Embedded working capital`
- `Withdraw Capital`
- `Available now`
- `Import invoices from QuickBooks`
- `Capital inside the PandaDoc workflow`
- `Platform monetization`
- `Capital provider yield`
- `Repayment tracked end to end`

## What to avoid

Do not lead with:

- `USDC`
- `wallet`
- `on-chain`
- `protocol`
- `Arena`
- `StaFi`
- `marketplace node`
- deep admin or accounting jargon

Those are implementation details. Only mention them if asked.

## Recommended flow

Use the public deployment:

- [pandadoc-qbo-integration-eight.vercel.app](https://pandadoc-qbo-integration-eight.vercel.app)

Ideal runtime:

- 6 to 8 minutes

Recommended order:

1. Landing page
2. Seller dashboard
3. Invoice list
4. Withdraw offer screen
5. Transactions / funded example
6. Operator repayment view
7. Capital pool view

## Talk track by screen

### 1. Landing page

URL:

- `/`

Say:

"The challenge is that document workflows are getting easier to replicate. The opportunity for PandaDoc is to move up the value chain by embedding financial infrastructure directly into the workflow. This demo shows invoice-based working capital as the first wedge."

Then:

"Instead of sending customers to an external lender, PandaDoc can let them import invoices and click `Withdraw Capital` right where the work already happens."

### 2. Seller dashboard

URL:

- `/factoring-dashboard`

Point to:

- connected PandaDoc workspace
- connected QuickBooks company
- eligible invoices
- funding capacity
- completed repayments

Say:

"This is the main seller experience. The user connects QuickBooks, PandaDoc stays in the loop, and eligible receivables are surfaced immediately. The key point is that financing becomes part of the product, not a link-out."

### 3. Invoice inventory

URL:

- `/invoices`

Point to:

- imported invoices
- due dates
- status
- working capital eligibility
- `Withdraw Capital` action

Say:

"Now the working capital opportunity is attached directly to the invoice list. The user does not need to export data, fill out a separate lender workflow, or wait for manual review just to understand eligibility."

### 4. Offer screen

Suggested invoice:

- invoice `9001`

URL pattern:

- `/factoring-dashboard/invoices/{invoiceId}/withdraw`

Point to:

- `Available now`
- `Advance rate`
- `Platform fee`
- `Expected repayment`
- delivery options

Say:

"This is the commercial moment. PandaDoc is not just storing the invoice; it is converting the invoice into a financing offer. The language is simple: how much is available now, what it costs, and when repayment is expected."

Then:

"If the user accepts, capital is advanced immediately and the invoice moves into a funded state."

### 5. Transaction detail

Use the seeded repaid example if you want a stable narrative without mutating data:

- invoice `9004`

Point to:

- funded / repaid lifecycle
- economics
- ledger movements
- audit trail

Say:

"This is important for trust. PandaDoc can show the full lifecycle of the advance, not just the initial offer. Every movement is tracked, which matters for finance teams and for operator visibility."

### 6. Operator console

URL:

- `/operator`

Point to:

- pending operator actions
- platform fees collected
- repayment simulation
- audit events

Say:

"This is how PandaDoc or its financing partner can operate the program. In the MVP we simulate repayment, but the important thing is that the workflow is already modeled end to end: fund, repay, book fees, close the position."

### 7. Capital pool dashboard

URL:

- `/capital-pool`

Point to:

- total pool balance
- deployed capital
- active funded invoices
- accrued yield
- platform fees

Say:

"This closes the loop on the business model. Sellers get working capital, capital providers earn yield, and PandaDoc captures platform fees. That is the monetization layer on top of the document workflow."

## Suggested close

Use this close almost verbatim:

"The strategic point is not just factoring. It is that PandaDoc can use embedded finance to turn a document workflow into a revenue-generating system of record. Factoring is the first concrete use case because the data already exists, the pain is real, and the value is immediate."

## Likely questions

### "What is real vs mocked?"

Answer:

"The product flow, state model, ledgering, funding logic, repayment logic, and dashboards are real. QuickBooks and PandaDoc can run in mock or OAuth mode. Settlement is simulated so the demo is reliable without production treasury rails."

### "Why is this better than a lending referral?"

Answer:

"A referral sends value and attention out of product. This keeps the financing action inside PandaDoc, where PandaDoc owns the workflow, the user relationship, and the monetization point."

### "Why start with QuickBooks?"

Answer:

"Because it is the fastest path to live invoice data, outstanding balances, and due dates. It makes the financing offer feel contextual and immediate."

### "What would production hardening require next?"

Answer:

"Live credentials, underwriting, permissions, real payout rails, reconciliation, and a tighter operator workflow. The MVP already proves the product shape and the business loop."

## Demo safety notes

For the first external meeting:

- prefer a fresh local environment or a recently reset demo environment
- if you want a deterministic story, use invoice `9004` to show the completed lifecycle
- only execute a new withdrawal live if you are sure the invoice is still unfunded

## One-line positioning

If you need a short opener:

"We are showing how PandaDoc can turn unpaid invoices into embedded working capital, directly inside the product, using QuickBooks data as the trigger."
