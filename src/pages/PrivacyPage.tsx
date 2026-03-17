export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 8, 2026</p>

      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">1. Information We Collect</h2>
          <p>We collect information you provide directly (email, name) and data from connected social media accounts (messages, profile information) as authorized by you through OAuth.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
          <p>We use your information to: provide and improve the Service, aggregate and prioritize your social media messages, send AI-powered classifications, and communicate with you about your account.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">3. Data from Connected Platforms</h2>
          <p>When you connect social media accounts (Instagram, TikTok, Twitter/X, Facebook, Gmail), we access only the data permitted by the scopes you authorize. This typically includes reading messages and basic profile information. We do not post on your behalf unless explicitly authorized.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">4. Data Storage & Security</h2>
          <p>Your data is stored securely using industry-standard encryption. OAuth tokens are stored server-side and are never exposed to the client. We use secure, authenticated connections for all data transfers.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">5. Data Sharing</h2>
          <p>We do not sell your personal data. We may share data with: service providers who assist in operating the Service, and as required by law.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">6. Your Rights</h2>
          <p>You may: access, correct, or delete your personal data; disconnect connected accounts at any time; delete your account entirely. To exercise these rights, visit your account settings.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">7. Cookies</h2>
          <p>We use essential cookies for authentication and session management. No third-party tracking cookies are used.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">8. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">9. Contact</h2>
          <p>For privacy-related questions, please contact us through the app's settings page.</p>
        </section>
      </div>
    </div>
  );
}
