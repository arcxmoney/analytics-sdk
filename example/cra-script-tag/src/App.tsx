import { Web3ReactHooks, Web3ReactProvider } from '@web3-react/core'
import { Connector } from '@web3-react/types'
import { ConsoleView } from './ConsoleView'
import { TestEventButtons } from './TestEventButtons'
import { TestPageButtons } from './TestPageButtons'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { CustomRequest } from './types/types'
import { Web3Buttons } from './Web3Buttons'
import { metamask, metamaskHooks } from './connectors'
import { EthereumEventsButtons } from './EthereumEventsButtons'
import { walletConnect, walletConnectHooks } from './connectors/walletConnect'

const connectors: [Connector, Web3ReactHooks][] = [
  [metamask, metamaskHooks],
  [walletConnect, walletConnectHooks],
]

function App() {
  const [capturedRequests, setCapturedRequests] = useState<CustomRequest[]>([])
  const hasModifiedFetchRef = useRef(false)
  const API_KEY = process.env.REACT_APP_ARCX_API_KEY
  if (!API_KEY) {
    throw new Error('REACT_APP_ARCX_API_KEY is not set')
  }

  useEffect(() => {
    if (hasModifiedFetchRef.current) return

    hasModifiedFetchRef.current = true

    // Hijack global fetch to capture the initial events
    const originalFetch = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      setCapturedRequests((capturedRequests) => {
        let body: any

        if (init?.body) {
          body = JSON.parse(init?.body?.toString() || '')
        }

        return [
          ...capturedRequests,
          {
            method: init?.method || 'GET',
            url: input.toString(),
            event: body?.event,
            attributes: body?.attributes,
          },
        ]
      })
      return originalFetch(input, init)
    }
  }, [])

  return (
    <Web3ReactProvider connectors={connectors}>
      <BrowserRouter>
        <div className="min-w-screen min-h-screen">
          <div className="container mx-auto">
            <div className="flex flex-col justify-center items-center mt-24 gap-4">
              <h1 className="text-5xl font-bold">
                0xArc Analytics Example Page |{' '}
                <span>
                  <Routes>
                    <Route path="/" element="Home" />
                    <Route path="/page-1" element="Page 1" />
                    <Route path="/page-2" element="Page 2" />
                    <Route path="/page-3" element="Page 3" />
                  </Routes>
                </span>
              </h1>
              <p className="text-center">
                Welcome to the 0xArc Analytics example page!
                <br />
                Click on the buttons below to change routes and fire events. You can observe what is
                being sent to the API below
              </p>
              <div className="max-w-md flex flex-col gap-4">
                <TestPageButtons />
                <TestEventButtons />
                <Web3Buttons />
                <EthereumEventsButtons />
              </div>
              <ConsoleView capturedRequests={capturedRequests} />
              <button
                className="rounded-full bg-white px-4 py-2 mb-4 hover:bg-gray-100 font-bold text-black"
                onClick={() => setCapturedRequests([])}
              >
                Clear console
              </button>
            </div>
          </div>
        </div>
      </BrowserRouter>
    </Web3ReactProvider>
  )
}

export default App
