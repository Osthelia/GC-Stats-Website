/**
 * GC-Stats - author-profile-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/admin/form-field";
import { AuthorLogoPanel } from "@/components/dashboard/news/author-logo-panel";
import { updateMyAuthorProfile, type AuthorProfile } from "@/actions/dashboard-author";
import { type AuthorProfileFieldErrors } from "@/lib/author-profile-validation";

export function AuthorProfileForm({ profile }: { profile: AuthorProfile }) {
  const t = useTranslations("dashboard.author");
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<AuthorProfileFieldErrors>({});

  const [name, setName] = useState(profile.name);
  const [slug, setSlug] = useState(profile.slug);
  const [bio, setBio] = useState(profile.bio);

  const err = (field: keyof AuthorProfileFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateMyAuthorProfile({ name, slug, bio });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label={t("fieldName")} htmlFor="author-name" required error={err("name")}>
                <Input id="author-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
              </FormField>

              <FormField label={t("fieldSlug")} htmlFor="author-slug" required error={err("slug")}>
                <Input id="author-slug" value={slug} onChange={(e) => setSlug(e.target.value)} aria-invalid={!!fieldErrors.slug} />
              </FormField>

              <FormField label={t("fieldBio")} htmlFor="author-bio" error={err("bio")}>
                <Textarea id="author-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} aria-invalid={!!fieldErrors.bio} />
              </FormField>
            </CardContent>
          </Card>
        </div>

        <AuthorLogoPanel displayName={profile.name} logoId={profile.logoId} logoUrl={profile.logoUrl} canEdit />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
