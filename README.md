[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/) [![npm version](https://badge.fury.io/js/@arcxmoney%2Fanalytics.svg)](https://badge.fury.io/js/@arcxmoney%2Fanalytics) [![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

> The 0xArc Analytics SDK is a simple SDK that helps provide higher fidelity analytics by merging on-chain data with off-chain data from front-ends. We value user privacy and do not collect IP addresses or scrape any information without your permission.

# Installation Guide

## Option 1 - via script tag (Metamask only)

---

Add the following to your `index.html`:

```html
<script>
  const script = document.createElement('script')
  const apiKey = YOUR_API_KEY
  const config = {} // Add any configuration parameters you'd like here
  script.src = '<https://unpkg.com/@arcxmoney/analytics>'
  script.onload = function () {
    ArcxAnalyticsSdk.init(apiKey, config, 'script-tag').then(function (sdk) {
      window.arcx = sdk
    })
  }

  document.head.appendChild(script)
</script>
```

That’s it! The 0xArc SDK will automatically detect wallet connections, referrer data, button clicks, page tracks and transactions that occur on your front-end.

You will now have access to the 0xArc SDK instance via `window.arcx` anywhere in the app, in case you want to use any specific functionality described in the [API section below](#api).

## Option 2 (via React Component)

---

1. Install the npm package:

```
yarn add @arcxmoney/analytics
```

or

```
npm install @arcxmoney/analytics --save
```

2. Use the `ArcxAnalyticsProvider` anywhere at the top of your component tree.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import { ArcxAnalyticsProvider } from '@arcxmoney/analytics'
import App from './App' // Import your main App component

const apiKey = 'YOUR_API_KEY' // Replace with your actual 0xArc analytics API key

const RootComponent = () => (
  <ArcxAnalyticsProvider apiKey={apiKey}>
    <App />
  </ArcxAnalyticsProvider>
)

ReactDOM.render(<RootComponent />, document.getElementById('root'))
```

3. Track wallet connection events whenever a wallet is connected

```jsx
const WalletConnectionTracker = () => {
  const { account, chainId } = useWeb3React()
  const sdk = useArcxAnalytics()

  useEffect(() => {
    if (account && chainId) {
      // Track the wallet connection with the SDK
      sdk.wallet({
        chainId,
        account,
      })
    }
  }, [account, chainId, sdk]) // Re-run this effect if account or chainId changes

  return <div>Tracking wallet connections with useWeb3React.</div>
}
```

4. Track transactions

```jsx
const TransactionButton = () => {
  const { account, chainId } = useWeb3React()
  const arcxAnalytics = useArcxAnalytics()

  const handleTransactionSubmit = async () => {
    // Example: Simulating a transaction call
    // In a real scenario, you would replace this with your transaction logic,
    // for example, using ethers.js or web3.js to interact with a smart contract

    const transactionHash = '0x023c0e7...' // Placeholder for the actual transaction hash

    // Assuming the transaction was successful and you have the hash
    // Now, track the transaction using the analytics SDK
    arcxAnalytics.transaction({
      transactionHash,
      account, // Optional: if not passed, the SDK will use the account from the last wallet() call
      chainId, // Optional: if not passed, the SDK will use the chainId from the last chain or wallet call
      metadata: {
        // Example metadata
        action: 'User Initiated Transaction',
      },
    })

    console.log('Transaction tracked!')
  }

  return <button onClick={handleTransactionSubmit}>Submit Transaction</button>
}
```

You are now ready to go! For additional methods supported, please see below.

#### Available SDK methods

| Method          | Parameters                                                                                                                                                                                                                                                                                                                                                            | Description                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `wallet`        | - `chainId`: string or number<br />- `account`: string                                                                                                                                                                                                                                                                                                                | Track a wallet connection event                                                                                         |
| `chain`         | - `chainId`: string or number<br />- `account`: string (optional). Will use the `account` value in the `wallet()` call if not passed                                                                                                                                                                                                                                  | Track a chain changed event                                                                                             |
| `transaction`   | - `transactionHash`: string<br />- `account`: string (optional). Will use the `account` value in the `wallet()` call if not passed<br />- `chainId`: string or number (optional). If not provided, the previously recorded chainID will be used<br />- `metadata`: dictionary (optional). This is additional information about the transaction you might want to pass | Track a transaction event                                                                                               |
| `signature`     | - `message`: string - message that was signed<br />- `signatureHash`: string (optional)<br />- `account`: string. Will use the `account` value in the `wallet()` call if not passed                                                                                                                                                                                   | Track a signature transaction                                                                                           |
| `disconnection` | - `account`: string (optional). The disconnected account. Will use the previously recorded account if not passed<br />- `chainId`: string or number (optional). Will use the previously recorded chain ID if not passed.                                                                                                                                              | Track a wallet disconnection event.                                                                                     |
| `event`         | - `name`: string. The name of the event<br />- `attributes`: dictionary (optional)                                                                                                                                                                                                                                                                                    | Track a custom event                                                                                                    |
| `page`          |                                                                                                                                                                                                                                                                                                                                                                       | Track a page view (current page). Note that you only have to call this if `trackPages` is set to `false` in the config. |

## Option 3 (via manual instantiation)

---

---

1. Install the npm package:

```
yarn add @arcxmoney/analytics
```

or

```
npm install @arcxmoney/analytics --save
```

2. Initialize the SDK and keep an instance of it ready to reference in other parts of your app. To do this, add the following code on your app’s load:

```jsx
import { ArcxAnalyticsSdk } from '@arcxmoney/analytics'

const sdk = await ArcxAnalyticsSdk.init(API_KEY, {
  // list any features you'd like to disable here
  trackPages: false,
  trackWalletConnections: false,
})
```

3. Track the blockchain-related and custom events you want using the method list from step 2 above.

# SDK Configuration

Regardless of which installation method you choose, you can disable any automatic tracking feature you want by passing an optional `config` parameter either to the `init` function or to the React provider.

The configuration options are:

| Config key               | Type    | Description                                                                                     | Default |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------- | ------- |
| `cacheIdentity`          | boolean | Caches the identity of users in the browser's local storage to capture cross-session behaviours | `true`  |
| `trackPages`             | boolean | Tracks whenever there is a URL change during the session and logs it automatically.             | `true`  |
| `trackWalletConnections` | boolean | Automatically track wallet connections (Metamask only)                                          | `true`  |
| `trackChainChanges`      | boolean | Automatically track chain ID changes (Metamask only)                                            | `true`  |
| `trackTransactions`      | boolean | Automatically track transaction requests (Metamask only)                                        | `true`  |
| `trackSigning`           | boolean | Automatically track signing requests (Metamask only)                                            | `true`  |
| `trackClicks`            | boolean | Automatically track click events                                                                | `true`  |

# API

### `init`

To initialize the Analytics SDK one should invoke the `init` method on the
class. This configures the SDK with your API key and, optionally, configuration
options.

**Note**: you do not need to call this function if using the React provider.

**Parameters:**

- `apiKey` **(string)** - the 0xArc-provided API key.
- `config` **(object)** - overrides of the SDK configuration [above](#sdk-configuration).

```js
await analytics = await ArcxAnalyticsSdk.init(
  YOUR_API_KEY, // The 0xArc-provided API key
  {
    cacheIdentity: true,
    trackReferrer: true,
    trackPages: true,
    trackUTM: true,
    trackTransactions: true,
  }
)
```

### `event`

A generic, catch-all `event` log. Use this method when no existing methods
satisfy your requirements.

**Parameters:**

- `event` **(string)** - the ID used to track this specific event.
- `attributes` **(object)** - an arbitrarily structured object of event information.

**Example:**

```js
await analytics.event('CHANGED_PFP', {
  oldPFP: 'dingo',
  newPFP: 'unicorn',
})
```

### `page`

Allows manual logging page visit events. Only use this method when `trackPages`
is set to `false`.

**Parameters:**

- (none)

**Example:**

```js
await analytics.page()
```

### `wallet`

Logs when a user connects their wallet to the dApp.

**Parameters:**

- `attributes` **(object)**
  - `chainId` **(number)** - the chain ID to which this address is connected on.
  - `account` **(string)** - the address of the connected wallet on the supplied chain.

**Example:**

```js
await analytics.wallet({
  account: '0x123',
  chainId: 1,
})
```

### `disconnection`

Logs a wallet disconnection event. This function will clear the cached known chain ID and account.

**Parameters:**

- `attributes` **(object, optional)**
  - `account` **(string, optional)** - The disconnected account address. If not provided, the function will use the previously recorded account address.
  - `chainId` **(string | number, optional)** - The chain ID from which the wallet was disconnected. If not passed, the function will use the previously recorded chain ID.

**Example:**

```typescript
await analytics.disconnection({
  account: '0x123',
  chainId: 1,
})
```

### `chain`

Logs when there is a change in the blockchain the user’s wallet is connected to. This function is instrumental in tracking user behaviour associated with different chains, facilitating a richer analysis in your 0xArc analytics setup.

**Parameters:**

- `attributes` **(object)**
  - `chainId` **(number | string)** - The updated chain ID to which the wallet is connected. It should be provided in either a hexadecimal or decimal format to facilitate the change log. This parameter is mandatory to invoke the function.
  - `account` **(string, optional)** - The account associated with the chain change event. If not specified, the function automatically resorts to using the previously recorded account from the last `connectWallet()` call or retrieves it from Metamask if it’s in use and the `trackWalletConnections` config is turned on.

**Example:**

```typescript
arcx.chain({ chainId: '1', account: '0x1234' })
```

### `transaction`

Logs when a transaction is submitted by a user.

**Parameters:**

- `attributes` **(object)**
  - `chainId` **(string | number)** - the chain ID where the transaction took place.
  - `transactionHash` **(string)** - the transaction hash of the transaction.
  - `metadata` **(object)** - an optional collection of transaction metadata that you wish to capture.

**Example:**

```js
await analytics.transaction({
  chainId: 1,
  transactionHash: '0xABCabc123',
})
```

### `signature`

Logs a signing event when a message is signed.

**Parameters:**

- `options` **(object)**
- `message` **(string)** - The message that was signed. This parameter is required and cannot be empty.
  - `signatureHash` **(string, optional)** - The hash of the signature. If not provided, it will be excluded from the event attributes.
- `account` **(string, optional)** - The account that signed the message. If not provided, the SDK will use the previously recorded account.

**Example:**

```typescript
await analytics.signature({
  message: 'Hello, world!',
  signatureHash: '0x123abc',
  account: '0x123',
})
```

# Important Notes

We do not support automatic wallet activity tracking with wallets other than Metamask.

Unless your dApp uses _only_ Metamask, you need to either use the installation option 2 or 3.

# Development notes

To run a local version of the script:

1. Run `yarn build` at the root level to build the script.
2. Run `yarn copy-build-example` to copy the built contents into the `example/cra-script-tag` project.
3. Make a copy of `.env.example` and rename it to `.env` in the `example/cra-script-tag` folder.
4. Make sure to add your 0xArc API + Alchemy keys to the `.env` file (find `YOUR_KEY_HERE`).
5. Run `cd example/cra-script-tag && yarn && yarn start` to start the example app.
