"use client";

import { useEffect, useState } from "react";
import Link from "@/components/prefetch-link";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthTracking } from "@/components/auth-tracking-provider";

export default function ProfilePage() {
  const {
    user,
    profile,
    guestAccess,
    updateProfile,
    trackAction,
  } = useAuthTracking();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setEmail(profile?.email ?? user?.email ?? "");
    setPhone(profile?.phone ?? user?.phone ?? "");
    setNotes(
      typeof profile?.additionalInfo?.notes === "string"
        ? profile.additionalInfo.notes
        : ""
    );
  }, [profile, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] text-slate-900 flex flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold">Profile Access</h1>
            <p className="mt-3 text-sm text-slate-600">
              Sign in to view and update your profile.
            </p>
            {guestAccess?.registrationRequired ? (
              <p className="mt-3 text-sm text-amber-700">
                Guest attempts remaining: {guestAccess.attemptsRemaining} / {guestAccess.limit}
              </p>
            ) : null}
            <Button asChild className="mt-6">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-900 flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-semibold">My Profile</h1>
            <p className="mt-2 text-sm text-slate-600">
              Update your account information.
            </p>

            <div className="mt-6 grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="profile-username">Username</Label>
                <Input id="profile-username" value={user.username} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+1..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-notes">Notes</Label>
                <Textarea
                  id="profile-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional profile notes..."
                  rows={5}
                />
              </div>
            </div>

            {status ? (
              <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {status}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setStatus(null);
                  try {
                    await updateProfile({
                      email: email || null,
                      phone: phone || null,
                      additionalInfo: {
                        ...(profile?.additionalInfo ?? {}),
                        notes,
                      },
                    });
                    setStatus("Profile updated.");
                    trackAction({
                      actionType: "profile_update",
                    });
                  } catch (error) {
                    setStatus(
                      error instanceof Error ? error.message : "Failed to update profile."
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
