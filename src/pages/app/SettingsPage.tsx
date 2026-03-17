import { useState } from "react";
import { Settings, User, Bell, FileText, Trash2, Copy, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TagBadge } from "@/components/TagBadge";
import { mockTemplates } from "@/lib/mock-data";
import { ReplyTemplate, MessageTag } from "@/lib/types";
import { SubscriptionCard } from "@/components/settings/SubscriptionCard";
import { useDemo } from "@/hooks/useDemo";
import { toast } from "sonner";

export default function SettingsPage() {
  const isDemo = useDemo();
  const [displayName, setDisplayName] = useState("Creator");
  const [email, setEmail] = useState("creator@example.com");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [collabAlerts, setCollabAlerts] = useState(true);
  const [templates, setTemplates] = useState<ReplyTemplate[]>(mockTemplates);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTag, setNewTag] = useState<MessageTag>("collab");

  const addTemplate = () => {
    if (!newName || !newContent) return;
    setTemplates((prev) => [...prev, { id: `t${Date.now()}`, name: newName, content: newContent, tag: newTag }]);
    setNewTemplateOpen(false);
    setNewName("");
    setNewContent("");
    toast.success("Template created");
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted");
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Subscription */}
        {!isDemo && <SubscriptionCard />}

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <User className="h-4 w-4" /> Profile
            </CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary font-display">
                {displayName[0]}
              </div>
              <Button variant="outline" size="sm">Change Avatar</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <Button size="sm" className="gradient-primary border-0" onClick={() => toast.success("Profile saved!")}>
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
            <CardDescription>Configure how you get notified</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Get emailed when high-priority Collabs arrive</p>
              </div>
              <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Browser push for new collab messages</p>
              </div>
              <Switch checked={pushNotifs} onCheckedChange={setPushNotifs} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Collab Alerts</p>
                <p className="text-xs text-muted-foreground">Instant alerts for messages tagged as Collab</p>
              </div>
              <Switch checked={collabAlerts} onCheckedChange={setCollabAlerts} />
            </div>
          </CardContent>
        </Card>

        {/* Reply Templates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Reply Templates
                </CardTitle>
                <CardDescription>Quick reply templates for common scenarios</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setNewTemplateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3 group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <TagBadge tag={t.tag} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        navigator.clipboard.writeText(t.content);
                        toast.success("Copied!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteTemplate(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Data Management
            </CardTitle>
            <CardDescription>Manage your imported data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm">Delete All Imported Messages</Button>
            <p className="text-xs text-muted-foreground mt-2">This action is irreversible. All imported messages will be permanently deleted.</p>
          </CardContent>
        </Card>
      </div>

      {/* New Template Dialog */}
      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New Reply Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input placeholder="e.g., Collab Follow-up" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tag</Label>
              <div className="flex gap-2">
                {(["sponsor", "collab", "fan", "spam", "other"] as MessageTag[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewTag(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      newTag === t ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                  >
                    <TagBadge tag={t} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Template Content</Label>
              <Textarea placeholder="Type your reply template..." value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateOpen(false)}>Cancel</Button>
            <Button className="gradient-primary border-0" onClick={addTemplate}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
