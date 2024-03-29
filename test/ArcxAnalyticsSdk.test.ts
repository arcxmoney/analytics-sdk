import sinon from 'sinon'
import { expect } from 'chai'
import { ArcxAnalyticsSdk, EIP1193Provider, SdkConfig } from '../src'
import {
  CURRENT_URL_KEY,
  DEFAULT_SDK_CONFIG,
  IDENTITY_KEY,
  SDK_VERSION,
  Event,
  SESSION_STORAGE_ID_KEY,
} from '../src/constants'
import * as postRequestModule from '../src/utils/postRequest'
import {
  TEST_ACCOUNT,
  TEST_API_KEY,
  TEST_CHAIN_ID,
  TEST_IDENTITY,
  TEST_JSDOM_URL,
  TEST_REFERRER,
  TEST_SCREEN,
  TEST_SESSION_STORAGE_ID,
  TEST_VIEWPORT,
} from './constants'
import { MockEthereum } from './MockEthereum'
import globalJsdom from 'global-jsdom'
import EventEmitter from 'events'
import * as SocketClientModule from '../src/utils/createClientSocket'
import { Socket } from 'socket.io-client'
import { fail } from 'assert'

const ALL_FALSE_CONFIG: Omit<SdkConfig, 'url'> = {
  cacheIdentity: false,
  trackPages: false,
  trackWalletConnections: false,
  trackChainChanges: false,
  trackTransactions: false,
  trackSigning: false,
  trackClicks: false,
}

describe('(unit) ArcxAnalyticsSdk', () => {
  let cleanup: () => void
  let postRequestStub: sinon.SinonStub
  let createClientSocketStub: sinon.SinonStub
  let socketStub: sinon.SinonStubbedInstance<Socket>

  beforeEach(() => {
    cleanup = globalJsdom(undefined, {
      url: TEST_JSDOM_URL,
      referrer: TEST_REFERRER,
    })

    window.ethereum = sinon.createStubInstance(MockEthereum)
    postRequestStub = sinon.stub(postRequestModule, 'postRequest').resolves(TEST_IDENTITY)
    socketStub = sinon.createStubInstance(Socket) as any
    socketStub.connected = true
    createClientSocketStub = sinon
      .stub(SocketClientModule, 'createClientSocket')
      .returns(socketStub as any)
    sinon.stub(screen, 'height').value(TEST_SCREEN.height)
    sinon.stub(screen, 'width').value(TEST_SCREEN.width)
    sinon.stub(window, 'innerHeight').value(TEST_VIEWPORT.height)
    sinon.stub(window, 'innerWidth').value(TEST_VIEWPORT.width)
  })

  afterEach(() => {
    sinon.restore()
    localStorage.clear()
    sessionStorage.clear()
    cleanup()
  })

  describe('#init', () => {
    describe('cacheIdentity', () => {
      it('does not get the identity from localStorage if `cacheIdentity` is false', async () => {
        const localStorageStub = sinon.stub(localStorage, 'getItem')
        await ArcxAnalyticsSdk.init(TEST_API_KEY, ALL_FALSE_CONFIG)
        expect(localStorageStub).to.not.have.been.called
      })

      it('sets the identity in localStorage if `cacheIdentity` is true', async () => {
        expect(localStorage.getItem(IDENTITY_KEY)).to.be.null
        await ArcxAnalyticsSdk.init(TEST_API_KEY, { ...ALL_FALSE_CONFIG, cacheIdentity: true })
        expect(localStorage.getItem(IDENTITY_KEY)).to.equal(TEST_IDENTITY)
      })
    })

    it('makes an /identity call when no identity is found in localStorage', async () => {
      await ArcxAnalyticsSdk.init('', ALL_FALSE_CONFIG)
      expect(postRequestStub.calledOnceWith(DEFAULT_SDK_CONFIG.url, '', '/identify')).to.be.true
    })

    it('makes an initial PAGE call if using the default config', async () => {
      await ArcxAnalyticsSdk.init('', { cacheIdentity: false })

      expect(socketStub.emit.firstCall).calledWith(
        'submit-event',
        getAnalyticsData(
          Event.PAGE,
          {
            referrer: TEST_REFERRER,
          },
          true,
        ),
      )
    })

    it('does not make a FIRST_PAGE_VISIT call if trackPages, referrer and UTM configs are set to false', async () => {
      await ArcxAnalyticsSdk.init('', ALL_FALSE_CONFIG)

      expect(postRequestStub).to.have.been.calledOnceWithExactly(
        DEFAULT_SDK_CONFIG.url,
        '',
        '/identify',
      )
    })

    describe('trackWalletConnections', () => {
      it('calls _reportCurrentWallet and register the listener if trackWalletConnections is true', async () => {
        window.ethereum = sinon.createStubInstance(MockEthereum)
        const reportCurrentWalletStub = sinon.stub(
          ArcxAnalyticsSdk.prototype,
          '_reportCurrentWallet' as any,
        )
        const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackWalletConnections: true })

        expect(reportCurrentWalletStub.calledOnce).to.be.true
        expect(sdk.provider?.on).calledWithMatch('accountsChanged')
        expect(sdk['_registeredProviderListeners']['accountsChanged']).to.not.be.null
      })

      it('calls _onAccountsChanged when accountsChanged is fired and trackWalletConnections is true', async () => {
        const provider = new MockEthereum()
        window.ethereum = provider
        const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackWalletConnections: true })

        const onAccountsChangedStub = sinon.stub(sdk, '_onAccountsChanged' as any)

        provider.emit('accountsChanged', [TEST_ACCOUNT])
        expect(onAccountsChangedStub).calledOnceWithExactly([TEST_ACCOUNT])
      })
    })

    describe('trackChainChanges', () => {
      let sdk: ArcxAnalyticsSdk

      beforeEach(async () => {
        sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackChainChanges: true })
        window.ethereum = new MockEthereum()
      })

      it('reports an error if provider is not set', async () => {
        const reportErrorStub = sinon.stub(sdk, '_report' as any)
        const eventStub = sinon.stub(sdk, '_event' as any)
        sdk['_provider'] = undefined

        expect(sdk.provider).to.be.undefined
        await sdk['_onChainChanged'](TEST_CHAIN_ID)
        expect(reportErrorStub).calledOnceWithExactly(
          'error',
          'ArcxAnalyticsSdk::_onChainChanged: provider not found. CHAIN_CHANGED not reported',
        )
        expect(eventStub).to.not.have.been.called
      })

      it('reports an error if this.currentConnectedAccount is not set and eth_requestAccounts returns an empty array', async () => {
        const reportErrorStub = sinon.stub(sdk, '_report' as any)
        const eventStub = sinon.stub(sdk, '_event' as any)

        expect(sdk.provider).to.not.be.undefined
        sdk.provider!.request = sinon.stub().resolves([])

        expect(sdk.currentConnectedAccount).to.be.undefined
        await sdk['_onChainChanged'](TEST_CHAIN_ID)
        expect(reportErrorStub).calledOnceWithExactly(
          'error',
          'ArcxAnalyticsSdk::_onChainChanged: unable to get account. eth_requestAccounts returned empty',
        )
        expect(eventStub).to.not.have.been.called
      })

      it('reports an error if this.provider.request throws an error that does not contain {code: 4001}', async () => {
        const reportErrorStub = sinon.stub(sdk, '_report' as any)
        const eventStub = sinon.stub(sdk, '_event' as any)

        expect(sdk.provider).to.not.be.undefined
        const testError = new Error('TestError')
        sdk.provider!.request = sinon.stub().throws(testError)

        expect(sdk.currentConnectedAccount).to.be.undefined
        await sdk['_onChainChanged'](TEST_CHAIN_ID)
        expect(reportErrorStub).calledOnceWithExactly(
          'error',
          'ArcxAnalyticsSdk::_onChainChanged: unable to get account. eth_requestAccounts threw an error',
          testError,
        )
        expect(eventStub).to.not.have.been.called
      })

      it('requests eth_requestAccounts on provider if this.currentConnectedAccount is undefined', async () => {
        const eventStub = sinon.stub(sdk, '_event' as any)

        expect(sdk.provider).to.not.be.undefined
        sdk.provider!.request = sinon.stub().resolves([TEST_ACCOUNT])

        expect(sdk.currentConnectedAccount).to.be.undefined
        await sdk['_onChainChanged'](TEST_CHAIN_ID)

        expect(sdk.currentConnectedAccount).to.eq(TEST_ACCOUNT)
        expect(sdk.provider!.request).calledOnceWithExactly({ method: 'eth_requestAccounts' })
        expect(eventStub).calledOnceWithExactly(Event.CHAIN_CHANGED, {
          chainId: TEST_CHAIN_ID,
          account: TEST_ACCOUNT,
        })
      })

      it('calls _onChainChanged when chainChanged is fired and trackChainChanges is true', async () => {
        const provider = new MockEthereum()
        window.ethereum = provider
        const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackChainChanges: true })

        const onChainChangedStub = sinon.stub(sdk, '_onChainChanged' as any)

        provider.emit('chainChanged', TEST_CHAIN_ID)
        expect(onChainChangedStub).calledOnceWithExactly(TEST_CHAIN_ID)
        expect(sdk['_registeredProviderListeners']['chainChanged']).to.not.be.null
      })
    })

    it('calls _trackSigning if trackSigning is true', async () => {
      const trackSigningStub = sinon.stub(ArcxAnalyticsSdk.prototype, '_trackSigning' as any)
      await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackSigning: true })

      expect(trackSigningStub).to.be.calledOnce
    })

    it('calls _trackClicks if config.trackClicks is true', async () => {
      const trackClicksStub = sinon.stub(ArcxAnalyticsSdk.prototype, '_trackClicks' as any)
      await ArcxAnalyticsSdk.init(TEST_API_KEY, { ...ALL_FALSE_CONFIG, trackClicks: true })

      expect(trackClicksStub).to.be.calledOnce
    })

    it('does not throw if window.ethereum.request is read-only', async () => {
      Object.defineProperty(window.ethereum, 'request', {
        value: () => console.log('modified request'),
        writable: false,
      })

      await ArcxAnalyticsSdk.init(TEST_API_KEY)
    })

    it('creates a websocket instance with query attributes', async () => {
      expect(sessionStorage.getItem(SESSION_STORAGE_ID_KEY)).to.be.null

      const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, undefined)
      const sessionId = sessionStorage.getItem(SESSION_STORAGE_ID_KEY)
      expect(sessionId).to.not.be.null

      expect(sdk['socket']).to.be.eq(socketStub)
      expect(createClientSocketStub).to.be.calledOnceWith(DEFAULT_SDK_CONFIG.url, {
        apiKey: TEST_API_KEY,
        identityId: TEST_IDENTITY,
        sdkVersion: SDK_VERSION,
        screenHeight: TEST_SCREEN.height,
        screenWidth: TEST_SCREEN.width,
        viewportHeight: TEST_VIEWPORT.height,
        viewportWidth: TEST_VIEWPORT.width,
        url: TEST_JSDOM_URL,
        sessionStorageId: sessionId,
      })
    })

    it('creates a websocket instance with the existing session id if one exists', async () => {
      sessionStorage.setItem(SESSION_STORAGE_ID_KEY, TEST_SESSION_STORAGE_ID)
      await ArcxAnalyticsSdk.init(TEST_API_KEY)

      expect(createClientSocketStub).to.be.calledOnceWith(DEFAULT_SDK_CONFIG.url, {
        apiKey: TEST_API_KEY,
        identityId: TEST_IDENTITY,
        sdkVersion: SDK_VERSION,
        screenHeight: TEST_SCREEN.height,
        screenWidth: TEST_SCREEN.width,
        viewportHeight: TEST_VIEWPORT.height,
        viewportWidth: TEST_VIEWPORT.width,
        url: TEST_JSDOM_URL,
        sessionStorageId: TEST_SESSION_STORAGE_ID,
      })
    })

    describe('Functionality', () => {
      let sdk: ArcxAnalyticsSdk

      beforeEach(async () => {
        sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, ALL_FALSE_CONFIG)
        // Reset history after init because of the /identify call
        postRequestStub.resetHistory()
      })

      describe('#event', () => {
        it('emits an event with the correct params if the socket is connected', () => {
          const attributes = {
            a: 'a',
            b: 'b',
            c: {
              d: 'd',
              e: 21,
            },
          }
          sdk.event('TEST_EVENT', attributes)
          expect(socketStub.emit).calledOnceWithExactly(
            'submit-event',
            getAnalyticsData(Event.CUSTOM, { name: 'TEST_EVENT', attributes }),
          )
        })

        it('supports nested attributes', async () => {
          const attributes = { layer1: { layer2: { layer3: { layer4: 'hello!' } } } }

          await sdk.event('TEST_EVENT', attributes)
          expect(socketStub.emit).calledOnceWithExactly(
            'submit-event',
            getAnalyticsData(Event.CUSTOM, { name: 'TEST_EVENT', attributes }),
          )
        })
      })

      describe('#page', () => {
        it('calls _event() with the given attributes', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const attributes = {
            referrer: TEST_REFERRER,
          }
          sdk.page()
          expect(eventStub).calledOnceWithExactly(Event.PAGE, attributes)
        })
      })

      describe('#wallet', () => {
        it('throws if chainId is empty', async () => {
          try {
            await sdk.wallet({
              chainId: '',
              account: TEST_ACCOUNT,
            })
          } catch (err: any) {
            expect(err.message).to.eq('ArcxAnalyticsSdk::wallet: chainId cannot be empty')
            return
          }
          fail('should throw')
        })

        it('throws if account is empty', async () => {
          try {
            await sdk.wallet({
              chainId: TEST_CHAIN_ID,
              account: '',
            })
          } catch (err: any) {
            expect(err.message).to.eq('ArcxAnalyticsSdk::wallet: account cannot be empty')
            return
          }
          fail('should throw')
        })

        it('saves the account and chainId to the sdk instance', async () => {
          expect(sdk.currentChainId).to.be.undefined
          expect(sdk.currentConnectedAccount).to.be.undefined

          await sdk.wallet({
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          })

          expect(sdk.currentChainId).to.eq(TEST_CHAIN_ID)
          expect(sdk.currentConnectedAccount).to.eq(TEST_ACCOUNT)
        })

        it('calls _event() with the given attributes', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const attributes = {
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          }
          await sdk.wallet(attributes)
          expect(eventStub).calledOnceWithExactly(Event.CONNECT, {
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          })
        })
      })

      describe('disconnection', () => {
        it('does not send an event if account and currentConnectedAccount are empty', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          await sdk.disconnection()
          expect(eventStub).to.not.have.been.called
        })

        it('submits a disconnect event with the given account if account is given', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          await sdk.disconnection({ account: TEST_ACCOUNT })
          expect(eventStub).calledOnceWithExactly(Event.DISCONNECT, {
            account: TEST_ACCOUNT,
          })
        })

        it('submits a disconnect event with the currentConnectedAccount if account is not given', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          sdk.currentConnectedAccount = TEST_ACCOUNT
          await sdk.disconnection()
          expect(eventStub).calledOnceWithExactly(Event.DISCONNECT, {
            account: TEST_ACCOUNT,
          })
        })

        it('sets the current chain id and current connected account to undefined', async () => {
          sdk.currentChainId = TEST_CHAIN_ID
          sdk.currentConnectedAccount = TEST_ACCOUNT
          await sdk.disconnection()
          expect(sdk.currentChainId).to.be.undefined
          expect(sdk.currentConnectedAccount).to.be.undefined
        })
      })

      describe('#chain', () => {
        it('throws if chainId is not provideed', async () => {
          try {
            await sdk.chain({
              chainId: '0',
            })
          } catch (err: any) {
            expect(err.message).to.eq('ArcxAnalyticsSdk::chain: chainId cannot be empty or 0')
            return
          }
          fail('should throw')
        })

        it('throws if chainId is not a valid hex or decimal number', async () => {
          sdk.currentConnectedAccount = TEST_ACCOUNT
          try {
            await sdk.chain({
              chainId: 'eth',
            })
          } catch (err: any) {
            expect(err.message).to.eq(
              'ArcxAnalyticsSdk::chain: chainId must be a valid hex or decimal number',
            )
            return
          }
          fail('should throw')
        })

        it('sets currentChainId to the given chainId', async () => {
          sdk.currentConnectedAccount = TEST_ACCOUNT

          expect(sdk.currentChainId).to.be.undefined

          await sdk.chain({
            chainId: parseInt(TEST_CHAIN_ID),
          })

          expect(sdk.currentChainId).to.eq(TEST_CHAIN_ID)
        })

        it('calls _event() with the given attributes', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const attributes = {
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          }
          await sdk.chain(attributes)
          expect(eventStub).calledOnceWithExactly(Event.CHAIN_CHANGED, {
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          })
        })

        it('if no account is passed, use the previously recorded account', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const attributes = {
            chainId: TEST_CHAIN_ID,
          }
          sdk.currentConnectedAccount = '0x123'
          await sdk.chain(attributes)
          expect(eventStub).calledOnceWithExactly(Event.CHAIN_CHANGED, {
            chainId: TEST_CHAIN_ID,
            account: '0x123',
          })
        })
      })

      describe('#transaction', () => {
        it('throws if transactionHash is empty', async () => {
          try {
            await sdk.transaction({
              transactionHash: '',
            })
          } catch (err: any) {
            expect(err.message).to.eq(
              'ArcxAnalyticsSdk::transaction: transactionHash cannot be empty',
            )
            return
          }
          fail('should throw')
        })

        it('throws if chainId and currentChainId are empty', async () => {
          try {
            await sdk.transaction({
              transactionHash: '0x123456789',
            })
          } catch (err: any) {
            expect(err.message).to.eq(
              'ArcxAnalyticsSdk::transaction: chainId cannot be empty and was not previously recorded',
            )
            return
          }
          fail('should throw')
        })

        it('throws if account and currentConnectedAccount are empty', async () => {
          try {
            await sdk.transaction({
              transactionHash: '0x123456789',
              chainId: '1',
            })
          } catch (err: any) {
            expect(err.message).to.eq(
              'ArcxAnalyticsSdk::transaction: account cannot be empty and was not previously recorded',
            )
            return
          }
          fail('should throw')
        })

        it('calls _event() with the given attributes', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const attributes = {
            chainId: '1',
            transactionHash: '0x123456789',
            metadata: { timestamp: '123456' },
          }
          sdk.currentConnectedAccount = TEST_ACCOUNT
          await sdk.transaction(attributes)
          expect(eventStub).calledOnceWithExactly(Event.TRANSACTION_SUBMITTED, {
            chainId: '1',
            account: TEST_ACCOUNT,
            transactionHash: '0x123456789',
            metadata: { timestamp: '123456' },
          })
        })
      })

      describe('#signature', () => {
        it('throws if message is empty', async () => {
          try {
            await sdk.signature({
              message: '',
            })
          } catch (err: any) {
            expect(err.message).to.eq('ArcxAnalyticsSdk::signature: message cannot be empty')
            return
          }
          fail('should throw')
        })

        it('throws if account is undefined and currentConnectedAccount is undefined', async () => {
          expect(sdk.currentConnectedAccount).to.be.undefined

          try {
            await sdk.signature({
              message: 'hello',
            })
          } catch (err: any) {
            expect(err.message).to.eq(
              'ArcxAnalyticsSdk::signature: account cannot be empty and was not previously recorded',
            )
            return
          }
          fail('should throw')
        })

        it('submits a signing event with the currentConnectedAccount if account is undefined', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          sdk.currentConnectedAccount = TEST_ACCOUNT
          await sdk.signature({
            message: 'hello',
          })
          expect(eventStub).calledOnceWithExactly(Event.SIGNING_TRIGGERED, {
            account: TEST_ACCOUNT,
            message: 'hello',
          })
        })

        it('submits a signing event with the given account if account is defined', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const account = '0x123'
          await sdk.signature({
            account,
            message: 'hello',
          })
          expect(eventStub).calledOnceWithExactly(Event.SIGNING_TRIGGERED, {
            account,
            message: 'hello',
          })
        })

        it('submits a signing event with the given hash if hash is defined', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          const account = '0x123'
          const hash = '0x123456789'
          await sdk.signature({
            account,
            signatureHash: hash,
            message: 'hello',
          })
          expect(eventStub).calledOnceWithExactly(Event.SIGNING_TRIGGERED, {
            account,
            signatureHash: hash,
            message: 'hello',
          })
        })
      })

      describe('#_trackProvider', () => {
        describe('setting a provider', () => {
          it('saves the original `request` to _originalRequest', async () => {
            const provider = new MockEthereum()
            const originalRequest = provider.request
            window.ethereum = undefined
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackTransactions: true })

            expect(sdk['_originalRequest']).to.be.undefined

            sdk['_trackProvider'](provider)

            expect(sdk['_originalRequest']).to.eq(originalRequest)
          })

          it('sets `provider` to the given provider', () => {
            expect(sdk.provider).to.eq(window.ethereum)

            const newProvider = new MockEthereum()
            sdk['_trackProvider'](newProvider)
            expect(sdk.provider).to.eq(newProvider)
          })

          it('calls _registerAccountsChangedListener if trackWalletConnections is true', async () => {
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackWalletConnections: true })

            const registerAccountsChangedStub = sinon.stub(
              sdk,
              '_registerAccountsChangedListener' as any,
            )

            expect(sdk['sdkConfig'].trackTransactions).to.be.true

            sdk['_trackProvider'](new MockEthereum())
            expect(registerAccountsChangedStub).to.be.called
          })

          it('registers a chainChanged listener if trackChainChanges is true', async () => {
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackChainChanges: true })

            const registerChainChangedStub = sinon.stub(sdk, '_registerChainChangedListener' as any)

            expect(sdk['sdkConfig'].trackChainChanges).to.be.true

            sdk['_trackProvider'](new MockEthereum())
            expect(registerChainChangedStub).to.be.called
          })

          it('calls _trackSigning if trackSigning is true', async () => {
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackSigning: true })

            const trackSigningStub = sinon.stub(sdk, '_trackSigning' as any)

            expect(sdk['sdkConfig'].trackSigning).to.be.true

            sdk['_trackProvider'](new MockEthereum())
            expect(trackSigningStub).to.be.called
          })

          it('calls _trackTransactions if trackTransactions is true', async () => {
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackTransactions: true })

            const trackTransactionsStub = sinon.stub(sdk, '_trackTransactions' as any)

            expect(sdk['sdkConfig'].trackTransactions).to.be.true

            sdk['_trackProvider'](new MockEthereum())
            expect(trackTransactionsStub).to.be.called
          })
        })

        describe('if a previous provider was set', () => {
          it('resets the original `request` function if trackTransactions is true', async () => {
            window.ethereum = new MockEthereum()
            const originalRequest = window.ethereum.request
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackTransactions: true })

            // Original request was changed during initialization
            expect(window.ethereum.request).to.not.eq(originalRequest)

            const newProvider = new MockEthereum()
            sdk['_trackProvider'](newProvider)

            expect(window.ethereum.request).to.eq(originalRequest)
          })

          it('resets the original `request` function if trackSigning is true', async () => {
            window.ethereum = new MockEthereum()
            const originalRequest = window.ethereum.request
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY, { trackSigning: true })

            // Original request was changed during initialization
            expect(window.ethereum.request).to.not.eq(originalRequest)

            const newProvider = new MockEthereum()
            sdk['_trackProvider'](newProvider)

            expect(window.ethereum.request).to.eq(originalRequest)
          })

          it('removes listeners if the new provider is undefined', async () => {
            window.ethereum = new MockEthereum()
            const sdk = await ArcxAnalyticsSdk.init(TEST_API_KEY)

            expect(sdk.provider).to.not.be.undefined
            expect((window.ethereum as any as EventEmitter).listenerCount('accountsChanged')).to.eq(
              1,
            )
            expect((window.ethereum as any as EventEmitter).listenerCount('chainChanged')).to.eq(1)

            sdk['_trackProvider']({
              on: sinon.stub(),
              removeListener: sinon.stub(),
              request: sinon.stub(),
            } as unknown as EIP1193Provider)

            expect((window.ethereum as any as EventEmitter).listenerCount('accountsChanged')).to.eq(
              0,
            )
            expect((window.ethereum as any as EventEmitter).listenerCount('chainChanged')).to.eq(0)
          })
        })
      })

      describe('#_reportError', () => {
        it('calls postRequest with error message', async () => {
          const errorMsg = 'TestError: this should not happen'
          await sdk['_report']('error', errorMsg)
          expect(postRequestStub).calledOnceWith(DEFAULT_SDK_CONFIG.url, TEST_API_KEY, '/log-sdk', {
            logLevel: 'error',
            data: {
              identityId: TEST_IDENTITY,
              msg: errorMsg,
              apiKey: TEST_API_KEY,
              url: TEST_JSDOM_URL,
            },
          })
        })

        it('calls postRequest with warning message', async () => {
          const errorMsg = 'TestError: this should not happen'
          await sdk['_report']('warning', errorMsg)
          expect(postRequestStub).calledOnceWith(DEFAULT_SDK_CONFIG.url, TEST_API_KEY, '/log-sdk', {
            logLevel: 'warning',
            data: {
              identityId: TEST_IDENTITY,
              msg: errorMsg,
              apiKey: TEST_API_KEY,
              url: TEST_JSDOM_URL,
            },
          })
        })
      })

      describe('#_trackFirstPageVisit', () => {
        let eventStub: sinon.SinonStub

        beforeEach(() => {
          eventStub = sinon.stub(sdk, '_event' as any)
        })

        it('sets the current window location to sessionStorage if trackPages is true', () => {
          sdk['sdkConfig'].trackPages = true

          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.be.null
          sdk['_trackFirstPageVisit']()

          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.eq(TEST_JSDOM_URL)
          sdk['sdkConfig'].trackPages = false
        })

        it('emits a PAGE event with url if trackPages is true', () => {
          sdk['sdkConfig'].trackPages = true

          sdk['_trackFirstPageVisit']()
          expect(eventStub).calledOnceWithExactly(
            Event.PAGE,
            {
              referrer: TEST_REFERRER,
            },
            true,
          )

          sdk['sdkConfig'].trackPages = false
        })

        it('emits a PAGE event with url, referrer and UTM attributes if trackPages, referrer and UTM configs are set to true', () => {
          sdk['sdkConfig'].trackPages = true

          sdk['_trackFirstPageVisit']()
          expect(eventStub).calledOnceWithExactly(
            Event.PAGE,
            {
              referrer: TEST_REFERRER,
            },
            true,
          )

          sdk['sdkConfig'].trackPages = false
        })
      })

      describe('#_trackPagesChange', () => {
        it('locationchange event does not exist', () => {
          const onLocationChangeStub = sinon.stub(sdk, <any>'_onLocationChange')

          window.dispatchEvent(
            new window.Event('locationchange', { bubbles: true, cancelable: false }),
          )

          expect(onLocationChangeStub).to.not.have.been.called
        })

        it('registers a locationchange event', () => {
          const onLocationChangeStub = sinon.stub(sdk, <any>'_onLocationChange')
          sdk['_trackPagesChange']()

          window.dispatchEvent(
            new window.Event('locationchange', { bubbles: true, cancelable: false }),
          )

          expect(onLocationChangeStub).calledOnce
        })

        describe('triggers a locationchange event', () => {
          it('triggers on history.pushState', () => {
            const locationChangeListener = sinon.spy()
            sdk['_trackPagesChange']()

            window.addEventListener('locationchange', locationChangeListener)
            window.history.pushState({}, '', '/new-url')
            expect(locationChangeListener).calledOnce

            window.removeEventListener('locationchange', locationChangeListener)
          })

          it('triggers on history.replaceState', () => {
            const locationChangeListener = sinon.spy()
            sdk['_trackPagesChange']()

            window.addEventListener('locationchange', locationChangeListener)
            window.history.replaceState({}, '', '/new-url')
            expect(locationChangeListener).calledOnce

            window.removeEventListener('locationchange', locationChangeListener)
          })

          it('triggers on history.popstate', () => {
            const locationChangeListener = sinon.spy()
            sdk['_trackPagesChange']()

            window.addEventListener('locationchange', locationChangeListener)
            window.dispatchEvent(new PopStateEvent('popstate'))
            expect(locationChangeListener).calledOnce

            window.removeEventListener('locationchange', locationChangeListener)
          })

          it('triggers multiple times', () => {
            const locationChangeListener = sinon.spy()
            sdk['_trackPagesChange']()

            window.addEventListener('locationchange', locationChangeListener)

            window.dispatchEvent(new PopStateEvent('popstate'))
            window.history.pushState({}, '', '/new-url')
            window.history.replaceState({}, '', '/new-url')

            expect(locationChangeListener).calledThrice

            window.removeEventListener('locationchange', locationChangeListener)
          })
        })
      })

      describe('#_onLocationChange', () => {
        it('sets the current location in the storage and calls page', () => {
          const pageStub = sinon.stub(sdk, 'page')
          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.be.null

          sdk['_onLocationChange']()

          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.eq(TEST_JSDOM_URL)
          expect(pageStub).to.be.calledOnceWithExactly()
        })

        it('sets the current location in the storage and calls page once if path is not changed ', () => {
          const pageStub = sinon.stub(sdk, 'page')
          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.be.null

          sdk['_onLocationChange']()
          sdk['_onLocationChange']()

          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.eq(TEST_JSDOM_URL)
          expect(pageStub).to.be.calledOnceWithExactly()
        })

        it('sets the current location in the storage and calls page twice if the path has changed', () => {
          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.be.null

          sdk['_onLocationChange']()
          window.history.pushState({}, '', `${TEST_JSDOM_URL}new`)
          sdk['_onLocationChange']()

          expect(sessionStorage.getItem(CURRENT_URL_KEY)).to.eq(`${TEST_JSDOM_URL}new`)
          expect(socketStub.emit).to.be.calledTwice
          expect(socketStub.emit.getCall(0)).to.be.calledWithExactly('submit-event', {
            event: Event.PAGE,
            attributes: {
              referrer: TEST_REFERRER,
            },
            url: TEST_JSDOM_URL,
            libraryType: 'npm-package',
          })
          expect(socketStub.emit.getCall(1)).to.be.calledWithExactly('submit-event', {
            event: Event.PAGE,
            attributes: {
              referrer: TEST_REFERRER,
            },
            url: TEST_JSDOM_URL + 'new',
            libraryType: 'npm-package',
          })
        })
      })

      describe('#_trackClicks', () => {
        it('does nothing if trackClicks is disabled', () => {
          const eventStub = sinon.stub(sdk, '_event' as any)

          window.dispatchEvent(new window.Event('click'))

          expect(eventStub).to.not.have.been.called
        })

        it('report warning if event target is not element', () => {
          sdk['_trackClicks']()
          const reportStub = sinon.stub(sdk, '_report')
          window.dispatchEvent(new window.Event('click'))
          expect(reportStub).is.calledOnceWithExactly(
            'warning',
            'ArcxAnalyticsSdk::_trackClicks: event target is not Element',
          )
        })
      })

      describe('#_handleAccountConnected', () => {
        it('calls connectWallet with the correct params', async () => {
          sinon.stub(sdk, <any>'_getCurrentChainId').resolves(TEST_CHAIN_ID)
          const connectWalletStub = sinon.stub(sdk, 'wallet')

          expect(sdk.currentChainId).to.be.undefined
          await sdk['_handleAccountConnected'](TEST_ACCOUNT)
          expect(sdk.currentChainId).to.eq(TEST_CHAIN_ID)

          expect(connectWalletStub).calledOnceWithExactly({
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          })
        })
      })

      describe('#_onChainChanged', () => {
        it('converts hex chain id to decimal and fires event', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)

          sdk.currentConnectedAccount = TEST_ACCOUNT
          await sdk['_onChainChanged']('0x1')

          expect(eventStub).calledOnceWithExactly(Event.CHAIN_CHANGED, {
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          })
        })
      })

      describe('#_reportCurrentWallet', () => {
        it('returns if the provider is non-existent', async () => {
          const requestStub = window.ethereum?.request
          const warnStub = sinon.stub(console, 'warn')

          sdk['_provider'] = undefined
          await sdk['_reportCurrentWallet']()

          expect(requestStub).to.not.have.been.called
          expect(warnStub).to.have.been.called
        })

        it('calls provider.request with eth_accounts', async () => {
          const provider = sdk.provider
          const requestStub = provider?.request

          await sdk['_reportCurrentWallet']()

          expect(requestStub).calledOnceWithExactly({ method: 'eth_accounts' })
        })

        it('does not call _handleAccountConnected if an account is returned', async () => {
          const handleAccountConnectedStub = sinon.stub(sdk, <any>'_handleAccountConnected')
          ;(window.ethereum?.request as any).resolves([])

          await sdk['_reportCurrentWallet']()

          expect(handleAccountConnectedStub).not.called
        })

        it('calls _handleAccountConnected if an account is returned', async () => {
          const handleAccountConnectedStub = sinon.stub(sdk, <any>'_handleAccountConnected')
          ;(window.ethereum?.request as any).resolves([TEST_ACCOUNT])

          await sdk['_reportCurrentWallet']()

          expect(handleAccountConnectedStub).calledOnceWithExactly(TEST_ACCOUNT)
        })
      })

      describe('#_getCurrentChainId', () => {
        it('throws if _provider is undefined', async () => {
          const originalEthereum = window.ethereum
          sdk['_provider'] = undefined

          try {
            await sdk['_getCurrentChainId']()
          } catch (err: any) {
            expect(err.message).to.eq('ArcxAnalyticsSdk::_getCurrentChainId: provider not set')
          }

          window.ethereum = originalEthereum
        })

        it('throws if no chain id is returned from ethereum.reqeust eth_chainId', async () => {
          const request: any = window.ethereum?.request
          request.resolves(undefined)

          try {
            await sdk['_getCurrentChainId']()
          } catch (err: any) {
            expect(err.message).to.eq(
              'ArcxAnalyticsSdk::_getCurrentChainId: chainIdHex is: undefined',
            )
          }
        })

        it('calls eth_chainId and returns a converted decimal chain id', async () => {
          const requestStub = (window.ethereum?.request as any).resolves('0x1')

          const chainId = await sdk['_getCurrentChainId']()

          expect(requestStub).calledOnceWithExactly({ method: 'eth_chainId' })
          expect(chainId).to.eq('1')
        })
      })

      describe('#_trackTransactions', () => {
        it('does not change request if provider is undefined', () => {
          sdk['_provider'] = undefined
          const reportErrorStub = sinon.stub(sdk, '_report')
          expect(sdk['_trackTransactions']()).to.be.false
          expect(reportErrorStub).to.be.calledOnce
        })

        it('makes a TRANSACTION_TRIGGERED event', async () => {
          const transactionParams = {
            gas: '0x22719',
            from: '0x884151235a59c38b4e72550b0cf16781b08ef7b0',
            to: '0x03cddc9c7fad4b6848d6741b0ef381470bc675cd',
            data: '0x97b4d89f0...082ec95a',
          }
          const nonce = 0xd // 13 in decimal

          // const stubProvider = sinon.createStubInstance(MockEthereum)
          // window.web3 = {
          //   currentProvider: stubProvider,
          // }

          ;(window.ethereum as any).request.returns(nonce as any).withArgs({
            method: 'eth_getTransactionCount',
            params: [transactionParams.from, 'latest'],
          })

          sdk = await ArcxAnalyticsSdk.init('', {
            ...ALL_FALSE_CONFIG,
            trackTransactions: true,
          })
          sdk.currentChainId = TEST_CHAIN_ID
          const eventStub = sinon.stub(sdk, '_event' as any)

          await window.ethereum!.request({
            method: 'eth_sendTransaction',
            params: [transactionParams],
          })
          expect(eventStub).calledOnceWithExactly(Event.TRANSACTION_TRIGGERED, {
            ...transactionParams,
            chainId: TEST_CHAIN_ID,
            nonce: '13',
          })
        })
      })

      describe('#_logTransactionSubmitted', () => {
        const txParams = {
          gas: '0x5208',
          value: '0x2540be400',
          from: '0x9581f442075eef408bd5e560cca77fcf598f601e',
          to: '0x0000000000000000000000000000000000000000',
        }

        it('reports an error if eth_chainId returns undefined or empty string', async () => {
          const requestStub = sinon.stub()
          requestStub
            .withArgs({
              method: 'eth_getTransactionCount',
              params: [txParams.from, 'latest'],
            })
            .resolves('0x1')
          requestStub.withArgs({ method: 'eth_chainId' }).resolves(undefined)
          // const requestStub = (window.ethereum?.request as any).resolves(undefined)
          const reportErrorStub = sinon.stub(sdk, '_report')
          const provider = {
            request: requestStub,
          }

          await sdk['_logTransactionSubmitted'](provider as any, txParams)

          expect(requestStub).calledTwice
          expect(requestStub.getCall(0)).to.have.been.calledWithExactly({
            method: 'eth_getTransactionCount',
            params: [txParams.from, 'latest'],
          })
          expect(requestStub.getCall(1)).to.have.been.calledWithExactly({
            method: 'eth_chainId',
          })
          expect(postRequestStub).to.not.have.been.called
          expect(reportErrorStub).to.have.been.calledWithExactly(
            'error',
            'ArcxAnalyticsSdk::_logTransactionSubmitted: Invalid chainId "undefined"',
          )
        })

        it('requests the nonce and logs the transaction', async () => {
          const requestStub = sinon
            .stub()
            .withArgs({
              method: 'eth_getTransactionCount',
              params: [txParams.from, 'latest'],
            })
            .resolves('0x1')

          const provider = {
            request: requestStub,
          }
          const eventStub = sinon.stub(sdk, '_event' as any)

          sdk.currentChainId = '2'
          await sdk['_logTransactionSubmitted'](provider as any, txParams)

          expect(requestStub).to.have.been.calledOnceWithExactly({
            method: 'eth_getTransactionCount',
            params: [txParams.from, 'latest'],
          })
          expect(eventStub).to.have.been.calledOnceWithExactly(Event.TRANSACTION_TRIGGERED, {
            ...txParams,
            nonce: '1',
            chainId: '2',
          })
        })

        it('requests eth_chainId if this.currentChainId is not set', async () => {
          const requestStub = sinon.stub()
          requestStub
            .withArgs({
              method: 'eth_getTransactionCount',
              params: [txParams.from, 'latest'],
            })
            .resolves('0x1')
          requestStub.withArgs({ method: 'eth_chainId' }).resolves('0x2')

          const provider = {
            request: requestStub,
          }
          const eventStub = sinon.stub(sdk, '_event' as any)

          expect(sdk.currentChainId).to.be.undefined
          await sdk['_logTransactionSubmitted'](provider as any, txParams)

          expect(requestStub).to.have.been.calledTwice
          expect(eventStub).to.have.been.calledOnceWithExactly(Event.TRANSACTION_TRIGGERED, {
            ...txParams,
            nonce: '1',
            chainId: '2',
          })
        })
      })

      describe('#_trackSigning', () => {
        const params = [
          '0x884151235a59c38b4e72550b0cf16781b08ef7b0',
          '0x389423948....4392049230493204',
        ]

        it('does not change request if provider is undefined', async () => {
          sdk['_provider'] = undefined
          const reportErrorStub = sinon.stub(sdk, '_report')
          expect(sdk['_trackSigning']()).to.be.false
          expect(reportErrorStub).to.be.calledOnce
        })

        it('returns true if provider is not undefined', () => {
          expect(sdk.provider).to.not.be.undefined
          expect(sdk['_trackSigning']()).to.be.true
        })

        it('makes a Events.SIGNING_TRIGGERED event if personal_sign appears', async () => {
          const method = 'personal_sign'

          sdk['_trackSigning']()
          const eventStub = sinon.stub(sdk, '_event' as any)
          await window.ethereum!.request({ method, params })

          expect(eventStub).calledWithExactly(Event.SIGNING_TRIGGERED, {
            account: params[1],
            message: params[0],
          })
        })

        it('makes a Events.SIGNING_TRIGGERED event if eth_sign appears', async () => {
          const method = 'eth_sign'

          sdk['_trackSigning']()
          const eventStub = sinon.stub(sdk, '_event' as any)
          await window.ethereum!.request({ method, params })

          expect(eventStub).calledWithExactly(Event.SIGNING_TRIGGERED, {
            account: params[0],
            message: params[1],
          })
        })

        it('makes a Events.SIGNING_TRIGGERED event if signTypedData_v4 appears', async () => {
          const method = 'signTypedData_v4'

          sdk['_trackSigning']()
          const eventStub = sinon.stub(sdk, '_event' as any)
          await window.ethereum!.request({ method, params })

          expect(eventStub).calledWithExactly(Event.SIGNING_TRIGGERED, {
            account: params[0],
            message: params[1],
          })
        })
      })

      describe('#_registerAccountsChangedListener', () => {
        it('registers an accountsChanged event listener and saves it to `_registeredProviderListeners`', async () => {
          const provider = new MockEthereum()
          window.ethereum = provider
          const sdk = await ArcxAnalyticsSdk.init('', ALL_FALSE_CONFIG)
          expect(provider.listenerCount('accountsChanged')).to.eq(0)
          sdk['_registerAccountsChangedListener']()
          expect(provider.listenerCount('accountsChanged')).to.eq(1)
        })
      })

      describe('#_registerChainChangedListener', () => {
        it('registers a chainChanged event listener and saves it to `_registeredProviderListeners`', async () => {
          const provider = new MockEthereum()
          window.ethereum = provider

          const sdk = await ArcxAnalyticsSdk.init('', ALL_FALSE_CONFIG)
          expect(provider.listenerCount('chainChanged')).to.eq(0)

          sdk['_registerChainChangedListener']()

          expect(provider.listenerCount('chainChanged')).to.eq(1)
        })
      })

      describe('#_handleAccountDisconnected', () => {
        it('does not call _event if currentChainId or currentConnectedAccount are undefined', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          sdk.currentConnectedAccount = undefined
          await sdk['_handleAccountDisconnected']()
          expect(eventStub).to.not.have.been.called

          sdk.currentConnectedAccount = TEST_ACCOUNT
          sdk.currentChainId = undefined
          await sdk['_handleAccountDisconnected']()
          expect(eventStub).to.have.been.called
        })

        it('calls _event with chainId and account and sets currentChainId and currentConnectedAccount to undefined', async () => {
          const eventStub = sinon.stub(sdk, '_event' as any)
          sdk.currentConnectedAccount = TEST_ACCOUNT
          sdk.currentChainId = TEST_CHAIN_ID
          await sdk['_handleAccountDisconnected']()
          expect(eventStub).calledOnceWithExactly(Event.DISCONNECT, {
            chainId: TEST_CHAIN_ID,
            account: TEST_ACCOUNT,
          })
          expect(sdk.currentConnectedAccount).to.be.undefined
          expect(sdk.currentChainId).to.be.undefined
        })
      })
    })
  })

  function getAnalyticsData(event: Event, attributes: any, ignoreLibraryUsage?: boolean) {
    return {
      event,
      attributes,
      url: TEST_JSDOM_URL,
      ...(!ignoreLibraryUsage && { libraryType: 'npm-package' }),
    }
  }
})
