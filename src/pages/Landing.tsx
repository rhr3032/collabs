import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Inbox, Tag, Zap, Shield, MessageSquare, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: Inbox,
    title: "Unified Inbox",
    description: "All your Collabs from Instagram, TikTok, X, and more — in one clean feed.",
  },
  {
    icon: Tag,
    title: "Auto-Tagging",
    description: "Instantly classify messages as Collabs, Fans, or Spam with confidence scores.",
  },
  {
    icon: Zap,
    title: "Priority View",
    description: "Never miss a brand deal. High-value messages surface to the top automatically.",
  },
  {
    icon: MessageSquare,
    title: "Quick Replies",
    description: "One-click reply templates for collabs, fan appreciation, and spam blocking.",
  },
  {
    icon: Filter,
    title: "Smart Filters",
    description: "Search by keyword, platform, tag, or date — find any message in seconds.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data stays yours. Disconnect anytime, delete everything on demand.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <nav className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            <span className="text-primary">Col</span>
            <span className="text-foreground">labs</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild className="gradient-primary border-0">
              <Link to="/login">Get Started <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main>
        <section className="container flex flex-col items-center pt-32 pb-20 text-center md:pt-44 md:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="mb-6 inline-block rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              Stop missing brand deals in your Collabs
            </span>
          </motion.div>

          <motion.h1
            className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Your Collabs, organized by{" "}
            <span className="gradient-text">priority</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Auto-tag collabs, fans, and spam across all your platforms. 
            Never miss a high-value message again.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button size="lg" asChild className="gradient-primary border-0 text-base px-8">
              <Link to="/login">Start Organizing <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base px-8">
              <Link to="/demo/inbox">Try Demo</Link>
            </Button>
          </motion.div>

          {/* Inbox preview mockup */}
          <motion.div
            className="mt-20 w-full max-w-4xl rounded-2xl border border-border bg-card p-1 shadow-2xl shadow-primary/5"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="rounded-xl bg-card p-6">
              <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
                <div className="h-3 w-3 rounded-full bg-tag-spam" />
                <div className="h-3 w-3 rounded-full bg-tag-collab" />
                <div className="h-3 w-3 rounded-full bg-tag-fan" />
                <span className="ml-2 text-sm text-muted-foreground font-medium">Inbox — 24 new messages</span>
              </div>
              {[
                { tag: "Collab", tagColor: "bg-tag-collab", sender: "Nike Brand Team", preview: "Hey! We'd love to discuss a partnership for our spring campaign...", time: "2m ago" },
                { tag: "Fan", tagColor: "bg-tag-fan", sender: "Sarah M.", preview: "OMG I love your latest video! The editing was incredible 🔥", time: "15m ago" },
                { tag: "Collab", tagColor: "bg-tag-collab", sender: "TechStartup CEO", preview: "Hi, we have a $5k budget for a sponsored review of our new app...", time: "1h ago" },
                { tag: "Spam", tagColor: "bg-tag-spam", sender: "Unknown", preview: "🎉 Congratulations! You've been selected for a FREE iPhone...", time: "3h ago" },
              ].map((msg, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {msg.sender[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{msg.sender}</span>
                      <span className={`${msg.tagColor} text-[10px] font-semibold px-2 py-0.5 rounded-full text-primary-foreground`}>
                        {msg.tag}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{msg.preview}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{msg.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-card/50 py-20 md:py-28">
          <div className="container">
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp}
              custom={0}
            >
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to tame your Collabs
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Built for creators who value their time and don't want to miss opportunities.
              </p>
            </motion.div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="group rounded-xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  variants={fadeUp}
                  custom={i + 1}
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28">
          <div className="container text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to take control?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Join thousands of creators who never miss important Collabs.
              </p>
              <Button size="lg" asChild className="mt-8 gradient-primary border-0 text-base px-8">
                <Link to="/login">Start Organizing <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="font-display text-sm font-semibold">
              <span className="text-primary">Col</span>
              <span className="text-foreground">labs</span>
            </span>
            <p className="text-sm text-muted-foreground">© 2026 Collabs. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
