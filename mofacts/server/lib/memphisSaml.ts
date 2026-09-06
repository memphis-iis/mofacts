import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { WebApp } from 'meteor/webapp';
import { XMLParser } from 'fast-xml-parser';
import { SAML, SamlStatusError, type Profile, type SamlConfig } from '@node-saml/node-saml';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import { inflateRawSync } from 'zlib';

const MEMPHIS_SAML_SERVICE_NAME = 'memphisSaml';
const MEMPHIS_SAML_LOGIN_PATH = '/auth/saml/memphis/login';
const MEMPHIS_SAML_ACS_PATH = '/auth/saml/memphis/acs';
const MEMPHIS_SAML_METADATA_PATH = '/auth/saml/memphis/metadata';
const SAML_REDIRECT_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
const SAML_POST_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST';
const DEFAULT_MEMPHIS_DISPLAY_NAME = 'Institutional SSO';
const MAX_FORM_BODY_BYTES = 1024 * 1024;
const SAML_HASH_ALGORITHMS = ['sha1', 'sha256', 'sha512'] as const;

type SamlHashAlgorithm = typeof SAML_HASH_ALGORITHMS[number];

type OAuthCompat = {
  _credentialTokenFromQuery: (query: Record<string, string>) => string;
  _loginStyleFromQuery: (query: Record<string, string>) => 'popup' | 'redirect';
  _storePendingCredential: (
    key: string,
    credential: unknown,
    credentialSecret?: string | null
  ) => Promise<void>;
  _renderOauthResults: (
    res: ServerResponse,
    query: Record<string, string>,
    credentialSecret?: string
  ) => Promise<void>;
  _endOfLoginResponse: (
    res: ServerResponse,
    details: {
      query: Record<string, string>;
      loginStyle: 'popup' | 'redirect';
      error?: unknown;
      credentials?: { token: string; secret: string };
    }
  ) => Promise<void>;
};

type MemphisSamlSettings = {
  enabled?: boolean;
  displayName?: string;
  metadataUrl?: string;
  entryPoint?: string;
  idpIssuer?: string;
  idpCert?: string | string[];
  idpCertPath?: string;
  issuer?: string;
  callbackUrl?: string;
  publicCert?: string;
  publicCertPath?: string;
  privateKey?: string;
  privateKeyPath?: string;
  identifierFormat?: string | null;
  disableRequestedAuthnContext?: boolean;
  signatureAlgorithm?: SamlHashAlgorithm;
  digestAlgorithm?: SamlHashAlgorithm;
  acceptedClockSkewMs?: number;
  wantAssertionsSigned?: boolean;
  wantAuthnResponseSigned?: boolean;
  signMetadata?: boolean;
};

type ResolvedMetadata = {
  entryPoint: string;
  idpCerts: string[];
  idpIssuer?: string | undefined;
};

type ResolvedMemphisSamlConfig = {
  enabled: boolean;
  displayName: string;
  samlConfig: SamlConfig;
  publicCert: string | null;
  privateKey: string | null;
};

type MemphisSamlServiceData = {
  id?: string | undefined;
  email?: string | undefined;
  mail?: string | undefined;
  displayName?: string | undefined;
  givenName?: string | undefined;
  surname?: string | undefined;
  eduPersonPrincipalName?: string | undefined;
  nameID?: string | undefined;
  nameIDFormat?: string | undefined;
  issuer?: string | undefined;
  attributes?: Record<string, unknown> | undefined;
};

const WebAppCompat = WebApp as unknown as {
  connectHandlers: {
    use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  };
};
const PackageAny = (globalThis as unknown as { Package?: Record<string, any> }).Package || {};
const OAuthAny = (PackageAny.oauth?.OAuth || null) as OAuthCompat | null;

let routesRegistered = false;
let serviceRegistered = false;
let resolvedConfigCache:
  | {
      cacheKey: string;
      fetchedAt: number;
      value: ResolvedMemphisSamlConfig;
    }
  | null = null;

function serverLog(...args: unknown[]) {
  console.log('[MEMPHIS-SAML]', ...args);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function getMemphisSamlSettings(): MemphisSamlSettings {
  return ((Meteor.settings as any)?.saml?.memphis || {}) as MemphisSamlSettings;
}

function normalizeRootUrl(): string {
  const rootUrl = String((Meteor.settings as any)?.ROOT_URL || Meteor.absoluteUrl()).trim();
  return rootUrl.replace(/\/+$/, '');
}

function buildIssuer(settings: MemphisSamlSettings): string {
  const configuredIssuer = typeof settings.issuer === 'string' ? settings.issuer.trim() : '';
  if (configuredIssuer) {
    return configuredIssuer;
  }
  return `${normalizeRootUrl()}${MEMPHIS_SAML_METADATA_PATH}`;
}

function buildCallbackUrl(settings: MemphisSamlSettings): string {
  const configuredCallbackUrl = typeof settings.callbackUrl === 'string' ? settings.callbackUrl.trim() : '';
  if (configuredCallbackUrl) {
    return configuredCallbackUrl;
  }
  return `${normalizeRootUrl()}${MEMPHIS_SAML_ACS_PATH}`;
}

function readOptionalFile(filePath: string | undefined): string | null {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return null;
  }
  return readFileSync(filePath.trim(), 'utf8').trim();
}

function readOptionalSettingValue(inlineValue: string | string[] | undefined, filePath: string | undefined): string | string[] | null {
  if (Array.isArray(inlineValue)) {
    return inlineValue.filter((value) => typeof value === 'string' && value.trim().length > 0);
  }
  if (typeof inlineValue === 'string' && inlineValue.trim()) {
    return inlineValue.trim();
  }
  return readOptionalFile(filePath);
}

function ensurePemCertificate(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes('BEGIN CERTIFICATE')) {
    return trimmed;
  }
  const base64Body = trimmed.replace(/\s+/g, '');
  const wrappedBody = base64Body.match(/.{1,64}/g)?.join('\n') || base64Body;
  return `-----BEGIN CERTIFICATE-----\n${wrappedBody}\n-----END CERTIFICATE-----`;
}

function ensurePemCertificateList(rawValue: string | string[] | null): string[] {
  return toArray(rawValue)
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map(ensurePemCertificate);
}

function coerceString(value: unknown): string {
  if (Array.isArray(value)) {
    return coerceString(value[0]);
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    const candidate = value as { '#text'?: unknown; _: unknown };
    if (typeof candidate['#text'] === 'string') {
      return candidate['#text'];
    }
    if (typeof candidate._ === 'string') {
      return candidate._;
    }
    return '';
  }
  return String(value);
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = coerceString(value).trim();
    if (candidate) {
      return candidate;
    }
  }
  return '';
}

function resolveSamlHashAlgorithm(
  settingName: 'signatureAlgorithm' | 'digestAlgorithm',
  value: unknown,
  defaultValue: SamlHashAlgorithm
): SamlHashAlgorithm {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if ((SAML_HASH_ALGORITHMS as readonly string[]).includes(normalized)) {
    return normalized as SamlHashAlgorithm;
  }
  throw new Error(
    `Invalid Memphis SAML ${settingName}: "${value}". Expected one of ${SAML_HASH_ALGORITHMS.join(', ')}.`
  );
}

function normalizeEmailLike(value: unknown): string {
  return coerceString(value).trim().toLowerCase();
}

function getProfileAttribute(profile: Profile, ...keys: string[]): string {
  for (const key of keys) {
    const value = profile[key];
    if (Array.isArray(value)) {
      const firstArrayValue = firstNonEmptyString(...value);
      if (firstArrayValue) {
        return firstArrayValue;
      }
      continue;
    }
    const candidate = firstNonEmptyString(value);
    if (candidate) {
      return candidate;
    }
  }
  return '';
}

function extractMemphisSamlEmailFromProfile(profile: Profile): string {
  return normalizeEmailLike(
    getProfileAttribute(
      profile,
      'email',
      'mail',
      'urn:oid:0.9.2342.19200300.100.1.3',
      'eduPersonPrincipalName',
      'urn:oid:1.3.6.1.4.1.5923.1.1.1.6'
    )
  );
}

export function extractMemphisSamlEmail(serviceData: MemphisSamlServiceData | null | undefined): string {
  if (!serviceData) {
    return '';
  }
  return normalizeEmailLike(
    serviceData.email ||
    serviceData.mail ||
    serviceData.eduPersonPrincipalName ||
    serviceData.nameID
  );
}

function extractMemphisSamlDisplayName(profile: Profile): string {
  const displayName = getProfileAttribute(
    profile,
    'displayName',
    'urn:oid:2.16.840.1.113730.3.1.241',
    'cn'
  );
  if (displayName) {
    return displayName;
  }
  const givenName = getProfileAttribute(profile, 'givenName', 'urn:oid:2.5.4.42');
  const surname = getProfileAttribute(profile, 'sn', 'surname', 'urn:oid:2.5.4.4');
  return [givenName, surname].filter(Boolean).join(' ').trim();
}

function extractStableExternalId(profile: Profile, normalizedEmail: string): string {
  return firstNonEmptyString(
    profile.nameID,
    getProfileAttribute(profile, 'eduPersonPrincipalName', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6'),
    normalizedEmail
  );
}

function sanitizeMongoKey(key: string): string {
  return key.replace(/\./g, '_').replace(/^\$/g, '_');
}

function sanitizeValueForMongo<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValueForMongo(entry)) as T;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const sanitizedEntries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
    sanitizeMongoKey(key),
    sanitizeValueForMongo(entryValue),
  ]);

  return Object.fromEntries(sanitizedEntries) as T;
}

function buildServiceData(profile: Profile): MemphisSamlServiceData {
  const normalizedEmail = extractMemphisSamlEmailFromProfile(profile);
  const eduPersonPrincipalName = normalizeEmailLike(
    getProfileAttribute(profile, 'eduPersonPrincipalName', 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6')
  );
  const displayName = extractMemphisSamlDisplayName(profile);
  const givenName = getProfileAttribute(profile, 'givenName', 'urn:oid:2.5.4.42');
  const surname = getProfileAttribute(profile, 'sn', 'surname', 'urn:oid:2.5.4.4');
  return {
    id: extractStableExternalId(profile, normalizedEmail),
    email: normalizedEmail || undefined,
    mail: normalizeEmailLike(getProfileAttribute(profile, 'mail', 'urn:oid:0.9.2342.19200300.100.1.3')) || undefined,
    displayName: displayName || undefined,
    givenName: givenName || undefined,
    surname: surname || undefined,
    eduPersonPrincipalName: eduPersonPrincipalName || undefined,
    nameID: firstNonEmptyString(profile.nameID) || undefined,
    nameIDFormat: firstNonEmptyString(profile.nameIDFormat) || undefined,
    issuer: firstNonEmptyString(profile.issuer) || undefined,
    attributes: profile.attributes
      ? sanitizeValueForMongo(profile.attributes as Record<string, unknown>)
      : undefined,
  };
}

function buildOptionsProfile(profile: Profile, serviceData: MemphisSamlServiceData) {
  const name = serviceData.displayName || firstNonEmptyString(profile.nameID) || undefined;
  return {
    profile: {
      ...(name ? { name } : {}),
      ...(serviceData.email ? { email: serviceData.email } : {}),
    }
  };
}

function parseMetadataDocument(metadataXml: string): ResolvedMetadata {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
  const parsedMetadata = parser.parse(metadataXml) as Record<string, any>;
  const entityDescriptor =
    parsedMetadata.EntityDescriptor ||
    toArray(parsedMetadata.EntitiesDescriptor?.EntityDescriptor)[0];

  if (!entityDescriptor) {
    throw new Error('Unable to locate an EntityDescriptor in the IdP metadata document.');
  }

  const idpDescriptor = toArray(entityDescriptor.IDPSSODescriptor)[0];
  if (!idpDescriptor) {
    throw new Error('Unable to locate an IDPSSODescriptor in the IdP metadata document.');
  }

  const ssoServices = toArray(idpDescriptor.SingleSignOnService);
  const redirectService =
    ssoServices.find((service) => service?.Binding === SAML_REDIRECT_BINDING) ||
    ssoServices.find((service) => service?.Binding === SAML_POST_BINDING) ||
    ssoServices[0];

  if (!redirectService?.Location) {
    throw new Error('Unable to locate a SingleSignOnService endpoint in the IdP metadata document.');
  }

  const signingCertificates = toArray(idpDescriptor.KeyDescriptor)
    .filter((keyDescriptor) => !keyDescriptor?.use || keyDescriptor.use === 'signing')
    .flatMap((keyDescriptor) =>
      toArray(keyDescriptor?.KeyInfo?.X509Data?.X509Certificate).map((certificate) => coerceString(certificate))
    )
    .filter(Boolean);

  if (signingCertificates.length === 0) {
    throw new Error('Unable to locate a signing certificate in the IdP metadata document.');
  }

  return {
    entryPoint: String(redirectService.Location),
    idpCerts: ensurePemCertificateList(signingCertificates),
    idpIssuer: firstNonEmptyString(entityDescriptor.entityID),
  };
}

async function fetchMetadata(metadataUrl: string): Promise<ResolvedMetadata> {
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch IdP metadata (${response.status} ${response.statusText}).`);
  }
  const metadataXml = await response.text();
  return parseMetadataDocument(metadataXml);
}

async function resolveMetadata(settings: MemphisSamlSettings): Promise<ResolvedMetadata> {
  const explicitEntryPoint = typeof settings.entryPoint === 'string' ? settings.entryPoint.trim() : '';
  const explicitIdpCert = ensurePemCertificateList(readOptionalSettingValue(settings.idpCert, settings.idpCertPath));
  const explicitIssuer = typeof settings.idpIssuer === 'string' ? settings.idpIssuer.trim() : '';

  if (explicitEntryPoint && explicitIdpCert.length > 0) {
    return {
      entryPoint: explicitEntryPoint,
      idpCerts: explicitIdpCert,
      idpIssuer: explicitIssuer || undefined,
    };
  }

  if (typeof settings.metadataUrl !== 'string' || !settings.metadataUrl.trim()) {
    throw new Error('Memphis SAML requires either entryPoint + idpCert or metadataUrl.');
  }

  const metadata = await fetchMetadata(settings.metadataUrl.trim());
  return {
    entryPoint: explicitEntryPoint || metadata.entryPoint,
    idpCerts: explicitIdpCert.length > 0 ? explicitIdpCert : metadata.idpCerts,
    idpIssuer: explicitIssuer || metadata.idpIssuer,
  };
}

function buildCacheKey(settings: MemphisSamlSettings): string {
  return JSON.stringify({
    enabled: !!settings.enabled,
    displayName: settings.displayName || '',
    metadataUrl: settings.metadataUrl || '',
    entryPoint: settings.entryPoint || '',
    idpIssuer: settings.idpIssuer || '',
    callbackUrl: settings.callbackUrl || '',
    issuer: settings.issuer || '',
    disableRequestedAuthnContext: settings.disableRequestedAuthnContext === true,
    signatureAlgorithm: settings.signatureAlgorithm || '',
    digestAlgorithm: settings.digestAlgorithm || '',
    idpCertPath: settings.idpCertPath || '',
    publicCertPath: settings.publicCertPath || '',
    privateKeyPath: settings.privateKeyPath || '',
    idpCert: settings.idpCert || '',
    publicCert: settings.publicCert || '',
    privateKey: settings.privateKey || '',
  });
}

async function getResolvedMemphisSamlConfig(): Promise<ResolvedMemphisSamlConfig> {
  const settings = getMemphisSamlSettings();
  const cacheKey = buildCacheKey(settings);
  if (resolvedConfigCache && resolvedConfigCache.cacheKey === cacheKey && Date.now() - resolvedConfigCache.fetchedAt < 10 * 60 * 1000) {
    return resolvedConfigCache.value;
  }

  const publicCertValue = readOptionalSettingValue(settings.publicCert, settings.publicCertPath);
  const privateKeyValue = readOptionalSettingValue(settings.privateKey, settings.privateKeyPath);

  const resolved: ResolvedMemphisSamlConfig = {
    enabled: settings.enabled === true,
    displayName: firstNonEmptyString(settings.displayName) || DEFAULT_MEMPHIS_DISPLAY_NAME,
    publicCert: typeof publicCertValue === 'string' ? ensurePemCertificate(publicCertValue) : null,
    privateKey: typeof privateKeyValue === 'string' ? privateKeyValue : null,
    samlConfig: {
      issuer: buildIssuer(settings),
      callbackUrl: buildCallbackUrl(settings),
      entryPoint: '',
      idpCert: [],
      additionalParams: {},
      additionalAuthorizeParams: {},
      identifierFormat: settings.identifierFormat === undefined ? null : settings.identifierFormat,
      disableRequestedAuthnContext: settings.disableRequestedAuthnContext !== false,
      signatureAlgorithm: resolveSamlHashAlgorithm('signatureAlgorithm', settings.signatureAlgorithm, 'sha256'),
      digestAlgorithm: resolveSamlHashAlgorithm('digestAlgorithm', settings.digestAlgorithm, 'sha256'),
      acceptedClockSkewMs: typeof settings.acceptedClockSkewMs === 'number' ? settings.acceptedClockSkewMs : 30000,
      wantAssertionsSigned: settings.wantAssertionsSigned !== false,
      wantAuthnResponseSigned: settings.wantAuthnResponseSigned !== false,
      signMetadata: settings.signMetadata === true,
    }
  };

  if (resolved.enabled) {
    const metadata = await resolveMetadata(settings);
    resolved.samlConfig = {
      ...resolved.samlConfig,
      entryPoint: metadata.entryPoint,
      idpCert: metadata.idpCerts,
      ...((metadata.idpIssuer || settings.idpIssuer)
        ? { idpIssuer: metadata.idpIssuer || settings.idpIssuer }
        : {}),
      ...(resolved.privateKey ? { privateKey: resolved.privateKey } : {}),
    };
  }

  resolvedConfigCache = {
    cacheKey,
    fetchedAt: Date.now(),
    value: resolved,
  };
  return resolved;
}

async function createSamlInstance(): Promise<{ config: ResolvedMemphisSamlConfig; saml: SAML }> {
  const resolvedConfig = await getResolvedMemphisSamlConfig();
  if (!resolvedConfig.enabled) {
    throw new Error('Memphis SAML is not enabled in settings.');
  }
  return {
    config: resolvedConfig,
    saml: new SAML(resolvedConfig.samlConfig),
  };
}

function writeTextResponse(res: ServerResponse, statusCode: number, body: string, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function getPathname(req: IncomingMessage): string {
  const requestUrl = new URL(req.url || '/', normalizeRootUrl());
  return requestUrl.pathname;
}

function getQueryValue(req: IncomingMessage, key: string): string {
  const requestUrl = new URL(req.url || '/', normalizeRootUrl());
  return requestUrl.searchParams.get(key) || '';
}

function getOAuthQueryForState(state: string): Record<string, string> {
  return { state };
}

function createXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
}

function safeHashForLog(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function summarizeAuthorizeUrl(authorizeUrl: string) {
  try {
    const parsedUrl = new URL(authorizeUrl);
    const relayState = parsedUrl.searchParams.get('RelayState') || '';
    const samlRequest = parsedUrl.searchParams.get('SAMLRequest') || '';
    const sigAlg = parsedUrl.searchParams.get('SigAlg') || '';

    let requestId = '';
    let issueInstant = '';
    let destination = '';
    let assertionConsumerServiceUrl = '';
    let issuer = '';
    let nameIdFormat = '';
    let allowCreate = '';

    if (samlRequest) {
      const requestXml = inflateRawSync(Buffer.from(samlRequest, 'base64')).toString('utf8');
      const parsedXml = createXmlParser().parse(requestXml) as Record<string, any>;
      const authnRequest = parsedXml.AuthnRequest || parsedXml['samlp:AuthnRequest'] || {};
      const nameIdPolicy = authnRequest.NameIDPolicy || authnRequest['samlp:NameIDPolicy'] || {};

      requestId = firstNonEmptyString(authnRequest.ID);
      issueInstant = firstNonEmptyString(authnRequest.IssueInstant);
      destination = firstNonEmptyString(authnRequest.Destination);
      assertionConsumerServiceUrl = firstNonEmptyString(authnRequest.AssertionConsumerServiceURL);
      issuer = firstNonEmptyString(authnRequest.Issuer, authnRequest['saml:Issuer']);
      nameIdFormat = firstNonEmptyString(nameIdPolicy.Format);
      allowCreate = firstNonEmptyString(nameIdPolicy.AllowCreate);
    }

    return {
      requestId,
      issueInstant,
      destination,
      assertionConsumerServiceUrl,
      issuer,
      relayStateHash: relayState ? safeHashForLog(relayState) : '',
      relayStateLength: relayState.length,
      hasSignature: parsedUrl.searchParams.has('Signature'),
      sigAlg,
      nameIdFormat: nameIdFormat || null,
      allowCreate: allowCreate || null,
    };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeSamlResponse(samlResponse: string, relayState: string) {
  try {
    const responseXml = Buffer.from(samlResponse, 'base64').toString('utf8');
    const parsedXml = createXmlParser().parse(responseXml) as Record<string, any>;
    const response = parsedXml.Response || {};
    const status = toArray(response.Status)[0] || {};
    const topLevelStatusCode = toArray(status.StatusCode)[0] || {};
    const nestedStatusCode = toArray(topLevelStatusCode.StatusCode)[0] || {};

    return {
      responseId: firstNonEmptyString(response.ID),
      inResponseTo: firstNonEmptyString(response.InResponseTo),
      issueInstant: firstNonEmptyString(response.IssueInstant),
      destination: firstNonEmptyString(response.Destination),
      issuer: firstNonEmptyString(response.Issuer),
      statusCode: firstNonEmptyString(topLevelStatusCode.Value),
      nestedStatusCode: firstNonEmptyString(nestedStatusCode.Value) || null,
      statusMessage: firstNonEmptyString(status.StatusMessage) || null,
      relayStateHash: relayState ? safeHashForLog(relayState) : '',
      relayStateLength: relayState.length,
      responseBytes: Buffer.byteLength(responseXml, 'utf8'),
    };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
      relayStateHash: relayState ? safeHashForLog(relayState) : '',
      relayStateLength: relayState.length,
    };
  }
}

async function renderPopupError(res: ServerResponse, relayState: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  serverLog('SAML popup error:', errorMessage);
  if (error instanceof SamlStatusError && typeof error.xmlStatus === 'string' && error.xmlStatus.trim()) {
    serverLog('SAML provider status XML:', error.xmlStatus);
  }

  if (!relayState || !OAuthAny) {
    writeTextResponse(res, 500, errorMessage);
    return;
  }

  try {
    const query = getOAuthQueryForState(relayState);
    const credentialToken = OAuthAny._credentialTokenFromQuery(query);
    await OAuthAny._storePendingCredential(credentialToken, new Error(errorMessage));
    await OAuthAny._endOfLoginResponse(res, {
      query,
      loginStyle: OAuthAny._loginStyleFromQuery(query),
      error: errorMessage,
    });
  } catch (responseError) {
    const fallbackMessage = responseError instanceof Error ? responseError.message : String(responseError);
    writeTextResponse(res, 500, `${errorMessage}\n${fallbackMessage}`);
  }
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_FORM_BODY_BYTES) {
        reject(new Error('SAML form payload exceeded the maximum supported size.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleMemphisSamlLogin(req: IncomingMessage, res: ServerResponse) {
  const relayState = getQueryValue(req, 'state');
  if (!relayState) {
    writeTextResponse(res, 400, 'Missing OAuth state for Memphis SAML login.');
    return;
  }

  try {
    const { saml } = await createSamlInstance();
    const authorizeUrl = await saml.getAuthorizeUrlAsync(
      relayState,
      typeof req.headers.host === 'string' ? req.headers.host : undefined,
      {}
    );
    serverLog('AuthnRequest summary:', summarizeAuthorizeUrl(authorizeUrl));
    res.writeHead(302, { Location: authorizeUrl });
    res.end();
  } catch (error) {
    await renderPopupError(res, relayState, error);
  }
}

async function handleMemphisSamlAcs(req: IncomingMessage, res: ServerResponse) {
  let relayState = '';
  try {
    const body = await readRequestBody(req);
    const formValues = Object.fromEntries(new URLSearchParams(body).entries());
    relayState = String(formValues.RelayState || '');
    const samlResponse = String(formValues.SAMLResponse || '');

    if (!relayState) {
      throw new Error('Missing RelayState in SAML response.');
    }
    if (!samlResponse) {
      throw new Error('Missing SAMLResponse in SAML callback.');
    }
    if (!OAuthAny) {
      throw new Error('Meteor OAuth internals are unavailable for Memphis SAML.');
    }

    const { saml } = await createSamlInstance();
    serverLog('ACS response summary:', summarizeSamlResponse(samlResponse, relayState));
    const validationResult = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
      RelayState: relayState,
    });

    if (validationResult.loggedOut || !validationResult.profile) {
      throw new Error('Memphis SAML did not return a usable login profile.');
    }

    const serviceData = buildServiceData(validationResult.profile);
    if (!serviceData.id) {
      throw new Error('Memphis SAML did not return a stable external identifier.');
    }

    const query = getOAuthQueryForState(relayState);
    const credentialToken = OAuthAny._credentialTokenFromQuery(query);
    const credentialSecret = Random.secret();
    await OAuthAny._storePendingCredential(
      credentialToken,
      {
        serviceName: MEMPHIS_SAML_SERVICE_NAME,
        serviceData,
        options: buildOptionsProfile(validationResult.profile, serviceData),
      },
      credentialSecret
    );
    await OAuthAny._renderOauthResults(res, query, credentialSecret);
  } catch (error) {
    await renderPopupError(res, relayState, error);
  }
}

async function handleMemphisSamlMetadata(_req: IncomingMessage, res: ServerResponse) {
  try {
    const { config, saml } = await createSamlInstance();
    const metadataXml = saml.generateServiceProviderMetadata(
      null,
      config.publicCert
    );
    writeTextResponse(res, 200, metadataXml, 'application/samlmetadata+xml; charset=utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeTextResponse(res, 500, message);
  }
}

function registerMemphisSamlRoutes() {
  if (routesRegistered) {
    return;
  }

  WebAppCompat.connectHandlers.use((req, res, next) => {
    const pathname = getPathname(req);
    if (pathname === MEMPHIS_SAML_LOGIN_PATH) {
      if (req.method !== 'GET') {
        writeTextResponse(res, 405, 'Method not allowed.');
        return;
      }
      void handleMemphisSamlLogin(req, res);
      return;
    }
    if (pathname === MEMPHIS_SAML_ACS_PATH) {
      if (req.method !== 'POST') {
        writeTextResponse(res, 405, 'Method not allowed.');
        return;
      }
      void handleMemphisSamlAcs(req, res);
      return;
    }
    if (pathname === MEMPHIS_SAML_METADATA_PATH) {
      if (req.method !== 'GET') {
        writeTextResponse(res, 405, 'Method not allowed.');
        return;
      }
      void handleMemphisSamlMetadata(req, res);
      return;
    }
    next();
  });

  routesRegistered = true;
}

function registerMemphisSamlService() {
  if (serviceRegistered) {
    return;
  }
  const oauthAccounts = Accounts as unknown as {
    oauth?: {
      registerService?: (name: string) => void;
      serviceNames?: () => string[];
    };
  };
  if (oauthAccounts.oauth?.serviceNames?.().includes(MEMPHIS_SAML_SERVICE_NAME)) {
    serviceRegistered = true;
    return;
  }
  oauthAccounts.oauth?.registerService?.(MEMPHIS_SAML_SERVICE_NAME);
  serviceRegistered = true;
}

export function getMemphisSamlClientConfig(): { enabled: boolean; displayName: string } {
  const settings = getMemphisSamlSettings();
  return {
    enabled: settings.enabled === true,
    displayName: firstNonEmptyString(settings.displayName) || DEFAULT_MEMPHIS_DISPLAY_NAME,
  };
}

export function isMemphisSamlAccountUser(user: unknown): boolean {
  const candidate = user as { services?: Record<string, unknown> } | null | undefined;
  return !!candidate?.services?.[MEMPHIS_SAML_SERVICE_NAME];
}

registerMemphisSamlService();
registerMemphisSamlRoutes();
