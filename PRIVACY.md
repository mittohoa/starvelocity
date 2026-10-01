# Privacy Policy — StarVelocity

_Last updated: 1 October 2026_

StarVelocity (`dev.starvelocity.app`) is an Android app that ranks public GitHub
repositories by how fast they are gaining stars.

## The short version

**The app collects nothing.** There is no account, no login, no analytics SDK,
no advertising SDK, and no crash-reporting SDK. Nothing you do in the app is
sent anywhere, because there is nowhere for it to be sent: the app has no
server of its own.

## What the app does over the network

StarVelocity makes read-only `GET` requests to two hosts:

| Host | What is requested | What is sent |
| ---- | ----------------- | ------------ |
| `mittohoa.github.io` | Pre-built JSON files listing public repositories and their star counts | Nothing beyond the ordinary HTTP request |
| `avatars.githubusercontent.com` | Public repository-owner avatar images | Nothing beyond the ordinary HTTP request |

No request carries a user identifier, a device identifier, an advertising ID, a
cookie, or any content you entered. All requests use HTTPS.

As with any internet request, the hosts above receive your device's IP address
and user-agent string at the network level. Those hosts are operated by GitHub,
Inc. and are governed by the
[GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).
StarVelocity neither reads nor retains that information.

## What is stored on your device

All of it stays on your device and never leaves it:

- **A cache of the JSON responses**, so the app still shows a ranking when you
  are offline. The app labels how old a cached copy is.
- **Your preferences**: the chosen theme, time window and language filter.

Uninstalling the app, or clearing its storage from Android Settings, deletes
both. There is nothing to request deletion of from us, because we hold nothing.

## Permissions and why they exist

| Permission | Why |
| ---------- | --- |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Fetching the ranking data and detecting whether the device is online |
| `POST_NOTIFICATIONS` | Posting the optional once-a-day digest notification. Android asks you for this at runtime and the app works fully without it |
| `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE` | Added by Android's WorkManager library, which schedules the daily refresh. The app runs no foreground service of its own |

## Children

StarVelocity is a tool for software developers. It is not directed at children
and collects no data from anyone, including children.

## Changes

If this policy ever changes, the updated version will be published at this same
URL with a new date at the top.

## Contact

Questions about this policy: **ttqlcntt.dev1@hutech.edu.vn**
