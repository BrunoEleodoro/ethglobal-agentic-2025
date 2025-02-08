'use client';

import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from '@coinbase/onchainkit/identity';
import ArrowSvg from './svg/ArrowSvg';
import ImageSvg from './svg/Image';
import OnchainkitSvg from './svg/OnchainKit';
import { SwapButton, Transaction } from '@coinbase/onchainkit/swap';
import { createSafeClient } from '@safe-global/sdk-starter-kit';
import { useAccount, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { sendTransaction } from 'viem/actions';
import { base } from 'viem/chains';

const components = [
  {
    name: 'Transaction',
    url: 'https://onchainkit.xyz/transaction/transaction',
  },
  { name: 'Swap', url: 'https://onchainkit.xyz/swap/swap' },
  { name: 'Checkout', url: 'https://onchainkit.xyz/checkout/checkout' },
  { name: 'Wallet', url: 'https://onchainkit.xyz/wallet/wallet' },
  { name: 'Identity', url: 'https://onchainkit.xyz/identity/identity' },
];

const templates = [
  { name: 'NFT', url: 'https://github.com/coinbase/onchain-app-template' },
  { name: 'Commerce', url: 'https://github.com/coinbase/onchain-commerce-template' },
  { name: 'Fund', url: 'https://github.com/fakepixels/fund-component' },
];

export default function App() {

  const { address, connector } = useAccount();
  const { switchChain } = useSwitchChain();
  const {
    data: hash,
    isPending,
    sendTransaction
  } = useSendTransaction()

  async function createAIWallet() {
     switchChain({ chainId: base.id });
    if (!address) {
      console.log("No address found");
      return;
    }
    const provider = await connector?.getProvider();
    if (!provider) {
      console.log("No provider found");
      return;
    }
    type DeploymentTransactionResponse = {
      to: string,
      value: string,
      data: string
    };
    const response = await fetch('/api/create', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
    const data = await response.json() as { deploymentTransaction: DeploymentTransactionResponse };
    console.log(data);

    await sendTransaction({
      account: address,
      data: data.deploymentTransaction.data as `0x${string}`,
      to: data.deploymentTransaction.to as `0x${string}`,
      value: BigInt(data.deploymentTransaction.value),
    });
  }

  return (
    <div className="flex flex-col min-h-screen font-sans dark:bg-background dark:text-white bg-white text-black">
      <header className="pt-4 pr-4">
        <div className="flex justify-end">
          <div className="wallet-container">
            <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownLink
                  icon="wallet"
                  href="https://keys.coinbase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wallet
                </WalletDropdownLink>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center">
        <div className="max-w-4xl w-full p-4">
          <div className="w-1/3 mx-auto mb-6">
            <ImageSvg />
          </div>
          <p className="text-center mb-6">
            Get started by editing
            <code className="p-1 ml-1 rounded dark:bg-gray-800 bg-gray-200">Hello World! I'm your AI Wallet</code>.
          </p>
          <div className="text-center my-6">
            <button
              type="button"
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => {
                createAIWallet();
              }}
            >
              Create Wallet with AI AGent
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
