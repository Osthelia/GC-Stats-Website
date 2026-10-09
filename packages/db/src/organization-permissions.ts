/**
 * GC-Stats — organization-permissions module
 *
 * Ceiling permissions an organization's own roles can ever be granted, set
 * by a site admin on `organizations.max_permissions`. Separate namespace
 * from the admin permission catalog in ./permissions: these never gate
 * anything in /admin itself, they only cap what /dashboard's
 * per-organization role system (organization_role_permissions) can ever
 * grant a member of that specific organization. Mirrors V1's
 * App\Support\PublisherPermissions for news_publishers.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const ORGANIZATION_PERMISSIONS = {
  profileEdit: "organization.profile.edit",
  logoUpload: "organization.logo.upload",
  membersManage: "organization.members.manage",
  newsView: "organization.news.view",
  newsEdit: "organization.news.edit",
  newsEditPublished: "organization.news.edit-published",
  newsReview: "organization.news.review",
  newsPublish: "organization.news.publish",
  newsDelete: "organization.news.delete",
  mediaView: "organization.media.view",
  mediaUpload: "organization.media.upload",
  mediaDelete: "organization.media.delete",
  streamsView: "organization.streams.view",
  streamsEdit: "organization.streams.edit",
  streamsDelete: "organization.streams.delete",
  streamsLink: "organization.streams.link",
  vodsLink: "organization.vods.link",
  staffManage: "organization.staff.manage",
  peopleCreate: "organization.people.create",
  peopleLinkUser: "organization.people.link-user",
  peopleEditProfile: "organization.people.edit-profile",
  apiKeysManage: "organization.api-keys.manage",
  logsView: "organization.logs.view",
} as const;

export type OrganizationPermissionName = (typeof ORGANIZATION_PERMISSIONS)[keyof typeof ORGANIZATION_PERMISSIONS];

export const ORGANIZATION_PERMISSION_GROUPS: { key: string; permissions: OrganizationPermissionName[] }[] = [
  { key: "profile", permissions: [ORGANIZATION_PERMISSIONS.profileEdit, ORGANIZATION_PERMISSIONS.logoUpload] },
  { key: "members", permissions: [ORGANIZATION_PERMISSIONS.membersManage] },
  { key: "news", permissions: [ORGANIZATION_PERMISSIONS.newsView, ORGANIZATION_PERMISSIONS.newsEdit, ORGANIZATION_PERMISSIONS.newsEditPublished, ORGANIZATION_PERMISSIONS.newsReview, ORGANIZATION_PERMISSIONS.newsPublish, ORGANIZATION_PERMISSIONS.newsDelete] },
  { key: "media", permissions: [ORGANIZATION_PERMISSIONS.mediaView, ORGANIZATION_PERMISSIONS.mediaUpload, ORGANIZATION_PERMISSIONS.mediaDelete] },
  { key: "streams", permissions: [ORGANIZATION_PERMISSIONS.streamsView, ORGANIZATION_PERMISSIONS.streamsEdit, ORGANIZATION_PERMISSIONS.streamsDelete, ORGANIZATION_PERMISSIONS.streamsLink] },
  { key: "vods", permissions: [ORGANIZATION_PERMISSIONS.vodsLink] },
  { key: "staff", permissions: [ORGANIZATION_PERMISSIONS.staffManage] },
  { key: "people", permissions: [ORGANIZATION_PERMISSIONS.peopleCreate, ORGANIZATION_PERMISSIONS.peopleLinkUser, ORGANIZATION_PERMISSIONS.peopleEditProfile] },
  { key: "apiKeys", permissions: [ORGANIZATION_PERMISSIONS.apiKeysManage] },
  { key: "logs", permissions: [ORGANIZATION_PERMISSIONS.logsView] },
];

// Granted automatically to every dashboard access of an organization linked to
// a team (teams.organization_id), on top of its roles and regardless of its
// max_permissions ceiling. Streams actions then restrict them to that team's matches,
// and the production credits section is hidden for such an organization.
export const LINKED_ORGANIZATION_PERMISSIONS: OrganizationPermissionName[] = [
  ORGANIZATION_PERMISSIONS.streamsView,
  ORGANIZATION_PERMISSIONS.streamsEdit,
  ORGANIZATION_PERMISSIONS.streamsDelete,
  ORGANIZATION_PERMISSIONS.streamsLink,
  // Org members are the team's staff, so editing them comes with the link too (staffManage, the production credits, does not).
  ORGANIZATION_PERMISSIONS.membersManage,
  ORGANIZATION_PERMISSIONS.peopleCreate,
  ORGANIZATION_PERMISSIONS.peopleLinkUser,
  ORGANIZATION_PERMISSIONS.peopleEditProfile,
];

// A linked organization can never hold these, even through its roles or ceiling:
// it only manages streams and its members.
export const LINKED_ORGANIZATION_FORBIDDEN_PERMISSIONS: OrganizationPermissionName[] = ORGANIZATION_PERMISSION_GROUPS.filter((g) => g.key === "news").flatMap((g) => g.permissions);

export const ALL_ORGANIZATION_PERMISSIONS: OrganizationPermissionName[] = ORGANIZATION_PERMISSION_GROUPS.flatMap((g) => g.permissions);
