#!/usr/bin/env node
/**
 * Tachyon emit health-check (ported from 1digit-website).
 *
 * Reads the ACTUAL endpoint + schema version out of public/tachyon-emit.js,
 * sends one synthetic event per schema, and asserts the ingress accepts it.
 *
 * Why this exists: in May 2026 a commit on the 1Digit site bumped CONFIG.version
 * with no matching backend schema, so every event silently 404'd and analytics
 * stopped landing for weeks with zero signal. This check turns that exact
 * failure into a loud, non-zero exit. Run it after any tracker change and on a
 * schedule (CI).
 *
 * Usage:
 *   node scripts/check-tachyon.mjs                       # PageLoaded against local script config
 *   node scripts/check-tachyon.mjs --deployed            # also check the live deployed script
 *   node scripts/check-tachyon.mjs --events PageLoaded,LeadCaptured,CtaClicked
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const LOCAL_PATH = resolve(process.cwd(), 'public/tachyon-emit.js');
const DEPLOYED_URL = 'https://mindlynx.ai/tachyon-emit.js';
const SITE = 'https://mindlynx.ai';

const eventsArg = process.argv.indexOf('--events');
const EVENTS = eventsArg > -1 ? process.argv[eventsArg + 1].split(',') : ['PageLoaded'];

function parseConfig(src) {
  const version = src.match(/version:\s*(\d+)/);
  const base = src.match(/endpointBase:\s*'([^']+)'/);
  if (!version) throw new Error('Could not find CONFIG.version in tachyon-emit.js');
  if (!base) throw new Error('Could not find CONFIG.endpointBase in tachyon-emit.js');
  return { version: Number(version[1]), base: base[1] };
}

// A representative envelope matching the shape the browser sends.
function buildEvent(version, eventName) {
  const now = new Date().toISOString();
  const payloads = {
    PageLoaded: {
      isNewVisitor: true,
      navigation: { type: 'initial', entryPage: true },
    },
    LeadCaptured: {
      formType: 'contact',
      interest: 'general',
      marketingOptIn: false,
      firstName: 'Health',
      lastName: 'Check',
      email: 'healthcheck@mindlynx.ai',
    },
    CtaClicked: {
      cta: 'healthcheck',
      href: '/',
      text: 'healthcheck',
      section: 'healthcheck',
    },
  };
  return {
    metadata: {
      locale: 'en_GB', pipeline: 'Website', source: 'Vivid', eventName,
      version, brand: 'MindLynx', service: 'web', module: 'MindLynx Tachyon', country: '',
      externalId: `healthcheck-${Date.now()}`, occurredAt: now, submittedAt: now,
      // NOTE: schemas reject a non-empty tags array (400); the real tracker
      // always sends []. Keep this empty; synthetic:true marks it a test.
      correlationId: '', tags: [], secondarySchemas: [],
      identity: { fp: 'healthcheck', sessionId: 'healthcheck' },
      pd: false, sc: 'public', synthetic: true, ingestionType: 'single', discoverable: true,
    },
    payload: {
      url: `${SITE}/`, path: '/', referrer: '', title: 'MindLynx healthcheck',
      timestamp: now, visitorId: 'healthcheck', sessionId: 'healthcheck',
      device: {
        type: 'desktop', viewportWidth: 1200, viewportHeight: 800, screenWidth: 1200,
        screenHeight: 800, pixelRatio: 1, language: 'en-GB', userAgent: 'tachyon-healthcheck', connection: '4g',
      },
      ...(payloads[eventName] || {}),
    },
  };
}

async function check(label, src) {
  const { version, base } = parseConfig(src);
  let allOk = true;
  for (const eventName of EVENTS) {
    const url = `${base}/${eventName}`;
    let res, body;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: SITE },
        body: JSON.stringify(buildEvent(version, eventName)),
      });
      body = await res.text();
    } catch (err) {
      console.error(`✗ [${label}] network error reaching Tachyon: ${err.message}`);
      allOk = false;
      continue;
    }
    if (res.status >= 200 && res.status < 300) {
      console.log(`✓ [${label}] Tachyon accepted ${eventName} v${version} (HTTP ${res.status})`);
    } else {
      console.error(`✗ [${label}] Tachyon REJECTED ${eventName} v${version}: HTTP ${res.status} (${body.slice(0, 120)})`);
      if (res.status === 404) {
        console.error(`   404 = no ${eventName} schema registered for version ${version} on the backend.`);
      }
      allOk = false;
    }
  }
  return allOk;
}

const checkDeployed = process.argv.includes('--deployed');
let ok = await check('local', readFileSync(LOCAL_PATH, 'utf-8'));

if (checkDeployed) {
  try {
    const deployedSrc = await (await fetch(`${DEPLOYED_URL}?cb=${Date.now()}`)).text();
    ok = (await check('deployed', deployedSrc)) && ok;
  } catch (err) {
    console.error(`✗ [deployed] could not fetch ${DEPLOYED_URL}: ${err.message}`);
    ok = false;
  }
}

if (!ok) {
  console.error('\nTachyon health-check FAILED: events are not being accepted.');
  process.exit(1);
}
console.log('\nTachyon health-check passed.');
