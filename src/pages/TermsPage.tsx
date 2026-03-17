export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 8, 2026</p>

      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using our application ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">2. Description of Service</h2>
          <p>Our Service provides a unified social media inbox that aggregates messages from connected platforms including Instagram, TikTok, Twitter/X, Facebook, and Gmail. We use AI to prioritize and categorize your messages.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">3. Account Registration</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials and for all activities under your account.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">4. Connected Accounts</h2>
          <p>When you connect third-party social media accounts, you authorize us to access your messages and profile information as permitted by each platform's API. You may disconnect accounts at any time.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">5. Acceptable Use</h2>
          <p>You agree not to misuse the Service, including but not limited to: violating any laws, infringing on others' rights, attempting to gain unauthorized access, or interfering with the Service's operation.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
          <p>The Service is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">7. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">8. Contact</h2>
          <p>For questions about these Terms, please contact us through the app's settings page.</p>
        </section>
      </div>
    </div>
  );
}
