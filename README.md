# ArcxAnalyticsSdk

`ArcxAnalyticsSdk` is a wrapper for [ARCx Analytics API](https://docs.arcx.money/#tag--analytics). It aims at increasing the usability and simplicity of our API.

```js
const arcxAnalyticsSdk = await ArcxAnalyticsSdk.init(YOUR_API_KEY)
await arcxAnalyticsSdk.event('EXAMPLE_EVENT', {
  attribute: 'random',
  anotherAttribute: 'value',
})
```

# Installation

```cli
npm install @arcxmoney/analytics
yarn add @arcxmoney/analytics
```

# Api

- [`init`](#init)
- [`event`](#event)
- [`page`](#page)
- [`transaction`](#transaction)
- [`connectWallet`](#connectWallet)

### `init`

This function is used to initialize the `ArcxAnalyticsSdk` instance. An `api key` is is required to invoke it, simply [contact us](https://discord.gg/hfrbGzPyK8) and we'll be happy to provide you one and start our collaboration.

`init` takes two arguments:

1. Api key (generated by the ARCx team) - required
2. Sdk configuration (see example below for detailed information) - optional

Example:

```javascript
import { ArcxAnalyticsSdk } from '@arcxmoney/analytics'

...
await arcxAnalyticsSdk = await ArcxAnalyticsSdk.init(
  YOUR_API_KEY,
  {
    trackPages: true, // default - automatically trigger PAGE event if the url changes after click
    cacheIdentity: true, // default - caches identity of users in their browser's local storage
  }
)
```

### `event`

Save a custom `event` in order to be analysed by the ARCx Team.

Example:

```javascript
import { ArcxAnalyticsSdk } from '@arcxmoney/analytics'

...
await arcxAnalyticsSdk = await ArcxAnalyticsSdk.init(YOUR_API_KEY)
await arcxAnalyticsSdk.event(
  'EXAMPLE_EVENT',
  {
    attribute: 'random',
    anotherAttribute: 'value',
  },
)
```

### `page`

Save a standardized `event` to track changes on a given page.

Example:

```javascript
import { ArcxAnalyticsSdk } from '@arcxmoney/analytics'

...
await arcxAnalyticsSdk = await ArcxAnalyticsSdk.init(YOUR_API_KEY)
await arcxAnalyticsSdk.page(
  'EXAMPLE_EVENT',
  {
    url: 'https://target.url',
  },
)
```

### `transaction`

Save a standardized `event` to track executed Web3 transactions.

Example:

```javascript
import { ArcxAnalyticsSdk } from '@arcxmoney/analytics'

...
await arcxAnalyticsSdk = await ArcxAnalyticsSdk.init(YOUR_API_KEY)

await analyticsSdk.transaction(
  transactionType, // required(string) - type of trasaction e.g. 'SWAP', 'STAKE'...
  transactionHash, // optional(string) - hash of the transaction
  attributes, // optional(object) - additional information about the transaction
)
```

### `connectWallet`

Save a standardized `event` to track connections to wallets.

Example:

```javascript
import { ArcxAnalyticsSdk } from '@arcxmoney/analytics'

...
await arcxAnalyticsSdk = await ArcxAnalyticsSdk.init(YOUR_API_KEY)

await analyticsSdk.connectWallet({
  account: '0x1234',
  chain: '1',
})
```