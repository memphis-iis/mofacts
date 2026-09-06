import { WebApp } from 'meteor/webapp';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs/promises';
import path from 'path';
import {
  DEPLOYMENT_BRAND_SOCIAL_IMAGE_ROUTE,
  type DeploymentBrandProfile,
} from '../../common/deploymentBrandProfile';
import { ensurePublishedDeploymentBrandProfile } from '../lib/deploymentBrandProfileRegistry';
import { themeRegistry } from '../lib/themeRegistry';

type ThemeLike = {
  activeThemeId?: string;
  themeName?: string;
  metadata?: {
    updatedAt?: string;
  };
  properties?: Record<string, unknown>;
};

const PWA_ICON_ROUTE_PREFIX = '/theme-install-icon/';
const APPLE_TOUCH_ICON_ROUTE = '/apple-touch-icon.png';
const APPLE_TOUCH_ICON_PRECOMPOSED_ROUTE = '/apple-touch-icon-precomposed.png';
const DEFAULT_BACKGROUND_COLOR = '#F2F2F2';
const WebAppAny = WebApp as unknown as {
  handlers: {
    use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  };
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getThemeColors(theme: ThemeLike) {
  const properties = theme.properties || {};
  const backgroundColor =
    asNonEmptyString(properties.app_background_color) ||
    asNonEmptyString(properties.navigation_surface_color) ||
    DEFAULT_BACKGROUND_COLOR;
  const themeColor =
    asNonEmptyString(properties.app_accent_color) ||
    asNonEmptyString(properties.app_background_color) ||
    DEFAULT_BACKGROUND_COLOR;

  return { backgroundColor, themeColor };
}

function buildManifestPayload(theme: ThemeLike, brandProfile: DeploymentBrandProfile) {
  const appName = brandProfile.identity.name;
  const shortName = brandProfile.identity.shortName;
  const description = brandProfile.locales[brandProfile.defaultLocale].socialDescription;
  const { backgroundColor, themeColor } = getThemeColors(theme);

  return {
    id: '/',
    name: appName,
    short_name: shortName,
    description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: brandProfile.identity.androidIcon192Url,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: brandProfile.identity.androidIcon512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: brandProfile.identity.androidMaskableIcon192Url,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: brandProfile.identity.androidMaskableIcon512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}

function resolveIconPropertyName(pathname: string) {
  switch (pathname) {
    case APPLE_TOUCH_ICON_ROUTE:
    case APPLE_TOUCH_ICON_PRECOMPOSED_ROUTE:
      return 'brand_apple_touch_icon_url';
  }

  switch (pathname) {
    case `${PWA_ICON_ROUTE_PREFIX}192.png`:
      return 'brand_android_icon_192_url';
    case `${PWA_ICON_ROUTE_PREFIX}512.png`:
      return 'brand_android_icon_512_url';
    case `${PWA_ICON_ROUTE_PREFIX}maskable-192.png`:
      return 'brand_android_maskable_icon_192_url';
    case `${PWA_ICON_ROUTE_PREFIX}maskable-512.png`:
      return 'brand_android_maskable_icon_512_url';
    default:
      return null;
  }
}

function inferContentTypeFromPath(assetPath: string) {
  const extension = path.extname(assetPath).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

async function findExistingAssetPath(relativePath: string) {
  const candidateRoots = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'app', 'public'),
    path.resolve(process.cwd(), '..', 'public'),
    path.resolve(process.cwd(), '..', 'app'),
    path.resolve(process.cwd(), '..', 'web.browser', 'app'),
    path.resolve(process.cwd(), '..', 'web.browser.legacy', 'app'),
    path.resolve(process.cwd(), '..', 'web.cordova', 'app'),
    '/opt/bundle/bundle/programs/web.browser/app',
    '/opt/bundle/bundle/programs/web.browser.legacy/app',
    '/opt/bundle/bundle/programs/web.cordova/app'
  ];

  for (const root of candidateRoots) {
    const resolvedPath = path.resolve(root, relativePath);
    const normalizedRoot = path.resolve(root);
    if (!resolvedPath.startsWith(normalizedRoot)) {
      continue;
    }
    try {
      await fs.access(resolvedPath);
      return resolvedPath;
    } catch (_error) {
      // Try the next candidate root.
    }
  }

  return null;
}

async function readThemeAssetFromUrl(assetUrl: string) {
  const parsedUrl = new URL(assetUrl, 'http://localhost');
  if (parsedUrl.origin !== 'http://localhost') {
    return null;
  }

  const pathname = decodeURIComponent(parsedUrl.pathname);
  const relativePath = pathname.replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('..')) {
    return null;
  }

  const resolvedPath = await findExistingAssetPath(relativePath);
  if (!resolvedPath) {
    return null;
  }
  const content = await fs.readFile(resolvedPath);
  return {
    content,
    contentType: inferContentTypeFromPath(resolvedPath)
  };
}

async function resolveThemeIconContent(theme: ThemeLike, propertyName: string) {
  const properties = theme.properties || {};
  const propertyValue = asNonEmptyString(properties[propertyName]);
  if (!propertyValue) {
    return null;
  }

  const dataUrlMatch = propertyValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    const contentType = dataUrlMatch[1] || 'application/octet-stream';
    const base64Payload = dataUrlMatch[2];
    if (!base64Payload) {
      return null;
    }
    return {
      content: Buffer.from(base64Payload, 'base64'),
      contentType
    };
  }

  return await readThemeAssetFromUrl(propertyValue);
}

WebAppAny.handlers.use(async function(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    next();
    return;
  }

  const requestUrl = req.url || '/';
  const parsedUrl = new URL(requestUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (
    pathname !== '/site.webmanifest' &&
    pathname !== '/manifest.json' &&
    pathname !== APPLE_TOUCH_ICON_ROUTE &&
    pathname !== APPLE_TOUCH_ICON_PRECOMPOSED_ROUTE &&
    !pathname.startsWith(PWA_ICON_ROUTE_PREFIX) &&
    pathname !== DEPLOYMENT_BRAND_SOCIAL_IMAGE_ROUTE
  ) {
    next();
    return;
  }

  try {
    const theme = (await themeRegistry.ensureActiveTheme()) as ThemeLike;
    const brandProfile = await ensurePublishedDeploymentBrandProfile();
    const identity = brandProfile.identity;
    const brandAssetTheme: ThemeLike = { properties: {
      brand_logo_url: identity.logoUrl,
      brand_favicon_16_url: identity.favicon16Url,
      brand_favicon_32_url: identity.favicon32Url,
      brand_apple_touch_icon_url: identity.appleTouchIconUrl,
      brand_android_icon_192_url: identity.androidIcon192Url,
      brand_android_icon_512_url: identity.androidIcon512Url,
      brand_android_maskable_icon_192_url: identity.androidMaskableIcon192Url,
      brand_android_maskable_icon_512_url: identity.androidMaskableIcon512Url,
      brand_social_image_url: identity.socialImageUrl,
    } };

    if (pathname === '/site.webmanifest' || pathname === '/manifest.json') {
      const payload = buildManifestPayload(theme, brandProfile);
      const body = JSON.stringify(payload);
      res.writeHead(200, {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      if (method === 'HEAD') {
        res.end();
        return;
      }
      res.end(body);
      return;
    }

    const propertyName = pathname === DEPLOYMENT_BRAND_SOCIAL_IMAGE_ROUTE
      ? 'brand_social_image_url'
      : resolveIconPropertyName(pathname);
    if (!propertyName) {
      res.writeHead(404, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    const resolvedIcon = await resolveThemeIconContent(brandAssetTheme, propertyName);
    if (!resolvedIcon) {
      res.writeHead(404, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': resolvedIcon.contentType,
      'Cache-Control': 'public, max-age=0, must-revalidate'
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(resolvedIcon.content);
  } catch (_error) {
    console.error('[PWA] Failed to serve manifest/icon route', {
      url: req.url || '',
      error: _error instanceof Error ? _error.message : String(_error)
    });
    res.writeHead(500, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end('Internal Server Error');
  }
});
