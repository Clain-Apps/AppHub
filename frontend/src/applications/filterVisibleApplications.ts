import type { HostedApplication } from "apphub-shared";

export function filterVisibleApplications({
  applications,
  showActiveOnly,
}: {
  applications: readonly HostedApplication[];
  showActiveOnly: boolean;
}): HostedApplication[] {
  if (!showActiveOnly) return [...applications];
  return applications.filter((application) => application.isActive);
}
