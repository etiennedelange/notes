export const REPO = "etiennedelange/notes";
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export type Platform = "windows" | "macos" | "linux";

export interface PlatformDownload {
  platform: Platform;
  label: string;
  primary: ReleaseAsset;
  extra: ReleaseAsset[];
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  url: string;
  publishedAt: string | null;
  platforms: PlatformDownload[];
}

// Distinguishes "the API told us there's genuinely nothing published" from
// "we couldn't find out" (network failure, rate limiting, a 5xx) — the two
// look identical to a visitor unless the caller keeps them apart.
export type ReleaseState =
  | { status: "found"; release: ReleaseInfo }
  | { status: "empty" }
  | { status: "error" };

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

// Order matters: the first matching suffix per platform is treated as the
// primary download (the installer format most people want by default).
const PLATFORM_SUFFIXES: [Platform, string[]][] = [
  ["windows", [".exe", ".msi"]],
  ["macos", [".dmg", ".app.tar.gz"]],
  ["linux", [".appimage", ".deb", ".rpm"]],
];

function classify(filename: string): Platform | null {
  const f = filename.toLowerCase();
  if (f.endsWith(".sig") || f.endsWith(".json") || f.endsWith(".blockmap")) return null;
  for (const [platform, suffixes] of PLATFORM_SUFFIXES) {
    if (suffixes.some((suffix) => f.endsWith(suffix))) return platform;
  }
  return null;
}

function suffixRank(platform: Platform, filename: string): number {
  const suffixes = PLATFORM_SUFFIXES.find(([p]) => p === platform)![1];
  const f = filename.toLowerCase();
  const index = suffixes.findIndex((suffix) => f.endsWith(suffix));
  return index === -1 ? suffixes.length : index;
}

export async function getLatestRelease(): Promise<ReleaseState> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    // GitHub returns 404 for a repo with no releases yet — that's a real
    // empty state, not a failure. Anything else non-OK (rate limit, 5xx) is
    // a failure we shouldn't dress up as "nothing published."
    if (res.status === 404) return { status: "empty" };
    if (!res.ok) return { status: "error" };

    const data = (await res.json()) as {
      tag_name: string;
      name: string | null;
      html_url: string;
      published_at: string | null;
      assets: { name: string; browser_download_url: string; size: number }[];
    };

    const grouped = new Map<Platform, ReleaseAsset[]>();
    for (const asset of data.assets ?? []) {
      const platform = classify(asset.name);
      if (!platform) continue;
      const list = grouped.get(platform) ?? [];
      list.push({ name: asset.name, url: asset.browser_download_url, size: asset.size });
      grouped.set(platform, list);
    }

    const platforms: PlatformDownload[] = (["windows", "macos", "linux"] as const)
      .filter((platform) => grouped.has(platform))
      .map((platform) => {
        const assets = grouped
          .get(platform)!
          .sort((a, b) => suffixRank(platform, a.name) - suffixRank(platform, b.name));
        const [primary, ...extra] = assets;
        return { platform, label: PLATFORM_LABELS[platform], primary, extra };
      });

    if (platforms.length === 0) return { status: "empty" };

    return {
      status: "found",
      release: {
        tag: data.tag_name,
        name: data.name || data.tag_name,
        url: data.html_url,
        publishedAt: data.published_at,
        platforms,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}
