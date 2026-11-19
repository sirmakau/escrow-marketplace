import { Link } from 'react-router-dom';
import { BookOpen, CircleHelp, ExternalLink, LayoutDashboard, Mail, MessageSquare, ReceiptText, ShieldCheck, Smartphone, Wallet as WalletIcon } from 'lucide-react';
import { Card, PageHeader, StatCard } from '../components/ui';

const FAQS = [
  {
    q: 'When does the seller get paid?',
    a: 'Funds are held by the platform after the buyer funds the escrow. Once the seller delivers and the buyer confirms, the buyer releases the funds. If nobody releases, support can step in through the dispute process.',
  },
  {
    q: 'Why can’t I create an escrow yet?',
    a: 'Creating an escrow requires verification tier 1. New accounts start at tier 0 and can still accept terms, fund escrows and receive payouts. Contact support to complete verification.',
  },
  {
    q: 'What happens if the terms change?',
    a: 'Every terms change creates a new version. The agreement returns to draft and the buyer must accept the new version before funding. Older acceptances no longer apply.',
  },
  {
    q: 'How are payments taken?',
    a: 'Escrow funding uses an M-Pesa STK Push to the buyer’s registered phone. A push notification on your phone is not proof of payment — the platform confirms the payment only after the M-Pesa callback is validated.',
  },
  {
    q: 'Can support edit my balance?',
    a: 'No. Balances move only through auditable ledger transactions. Support can resolve disputes, which trigger an authorised refund or release recorded in the ledger.',
  },
  {
    q: 'What evidence should I provide in a dispute?',
    a: 'Describe what was agreed and what went wrong, and keep proof of delivery or communication ready. Evidence upload is not yet available in this API version, so support will request evidence through the support channel.',
  },
];

export function Help() {
  return (
    <>
      <PageHeader
        title="Help & Support"
        description="Understand how escrow protects both sides, and how to get help."
      />

      <div className="dashboard-grid">
        <Card title="Current status" className="span-2">
          <div className="stats-grid">
            <StatCard
              label="Backend"
              value="Deployed"
              hint="Render web service · rootDir: server"
              icon={<LayoutDashboard size={16} />}
              tone="emerald"
            />
            <StatCard
              label="M-Pesa mode"
              value="Sandbox"
              hint="Change MPESA_MODE in the dashboard to go live"
              icon={<ReceiptText size={16} />}
              tone="navy"
            />
            <StatCard
              label="Callback URL"
              value="https://escrow-marketplace-8ndh.onrender.com/api/payments/mpesa/stk-callback"
              hint="Set in the Daraja app under STK Push"
              icon={<Smartphone size={16} />}
              tone="amber"
            />
            <StatCard
              label="Frontend"
              value="Vercel"
              hint="https://escrow-marketplace-ke.vercel.app"
              icon={<WalletIcon size={16} />}
              tone="emerald"
            />
          </div>
        </Card>

        <Card title="How escrow works" className="span-2">
          <ol className="how-list">
            <li>
              <span className="how-icon"><BookOpen size={18} /></span>
              <div>
                <strong>1. Agree the terms</strong>
                <p>The seller drafts the scope, price, callout fee and delivery mode. The buyer accepts that exact version.</p>
              </div>
            </li>
            <li>
              <span className="how-icon"><Smartphone size={18} /></span>
              <div>
                <strong>2. Fund the escrow</strong>
                <p>The buyer pays by M-Pesa. The platform holds the funds and confirms the payment only after the callback is verified.</p>
              </div>
            </li>
            <li>
              <span className="how-icon"><ShieldCheck size={18} /></span>
              <div>
                <strong>3. Deliver and release</strong>
                <p>The seller delivers and marks it complete; the buyer confirms and releases. Disputes pause release until support resolves them.</p>
              </div>
            </li>
          </ol>
        </Card>

        <Card title="M-Pesa callback in Daraja">
          <ul className="contact-list">
            <li>
              <ReceiptText size={16} aria-hidden="true" />
              <div>
                <strong>Callback URL</strong>
                <span>
                  Paste this into the Daraja app under STK Push → Call Back URL:
                  <br />
                  <code className="mono">https://escrow-marketplace-8ndh.onrender.com/api/payments/mpesa/stk-callback</code>
                </span>
              </div>
            </li>
            <li>
              <ExternalLink size={16} aria-hidden="true" />
              <div>
                <strong>Sandbox testing</strong>
                <span>
                  Use the deployed backend directly.
                  A local tunnel is not required now that the callback URL is public HTTPS.
                </span>
              </div>
            </li>
            <li>
              <Mail size={16} aria-hidden="true" />
              <div>
                <strong>Credentials</strong>
                <span>
                  Sandbox consumer key/secret, shortcode, passkey and initiator credentials
                  come from the Safaricom Developer Portal and are set as env vars on Render.
                </span>
              </div>
            </li>
          </ul>
        </Card>

        <Card title="Contact support">
          <ul className="contact-list">
            <li>
              <MessageSquare size={16} aria-hidden="true" />
              <div>
                <strong>Dispute help</strong>
                <span>Open the escrow and select “Open dispute” to start a tracked review.</span>
              </div>
            </li>
            <li>
              <Mail size={16} aria-hidden="true" />
              <div>
                <strong>Email</strong>
                <span>support@escrow.example (replace with your live support address)</span>
              </div>
            </li>
            <li>
              <CircleHelp size={16} aria-hidden="true" />
              <div>
                <strong>Account issues</strong>
                <span>
                  See <Link to="/profile">Profile & Verification</Link> for tier and security
                  details.
                </span>
              </div>
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Frequently asked questions">
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </>
  );
}

