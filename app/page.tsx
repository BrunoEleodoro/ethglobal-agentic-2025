"use client";

import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import ArrowSvg from "./svg/ArrowSvg";
import ImageSvg from "./svg/Image";
import OnchainkitSvg from "./svg/OnchainKit";
import { SwapButton, Transaction } from "@coinbase/onchainkit/swap";
import { createSafeClient } from "@safe-global/sdk-starter-kit";
import {
  useAccount,
  useSendTransaction,
  useSwitchChain,
  useTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sendTransaction } from "viem/actions";
import { base } from "viem/chains";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";

const components = [
  {
    name: "Transaction",
    url: "https://onchainkit.xyz/transaction/transaction",
  },
  { name: "Swap", url: "https://onchainkit.xyz/swap/swap" },
  { name: "Checkout", url: "https://onchainkit.xyz/checkout/checkout" },
  { name: "Wallet", url: "https://onchainkit.xyz/wallet/wallet" },
  { name: "Identity", url: "https://onchainkit.xyz/identity/identity" },
];

const templates = [
  { name: "NFT", url: "https://github.com/coinbase/onchain-app-template" },
  {
    name: "Commerce",
    url: "https://github.com/coinbase/onchain-commerce-template",
  },
  { name: "Fund", url: "https://github.com/fakepixels/fund-component" },
];

export default function App() {
  const { address, connector } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: hash, isPending, sendTransaction } = useSendTransaction();
  // transaction receipt

  const { data: receipt, isPending: isReceiptPending } = useTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (receipt) {
      console.log(receipt);
    }
  }, [receipt]);

  const [createWalletLoading, setCreateWalletLoading] = useState(false);
  const [createWalletSuccess, setCreateWalletSuccess] = useState(false);
  const [createWalletError, setCreateWalletError] = useState<string | null>(
    null
  );

  const { mutate: createWallet } = useMutation({
    mutationFn: async () => {
      setCreateWalletLoading(true);
      setCreateWalletSuccess(false);
      setCreateWalletError(null);
      try {
        const response = await fetch("/api/create", {
          method: "POST",
          body: JSON.stringify({ address }),
        });
        const data = (await response.json()) as {
          deploymentTransaction: {
            to: string;
            value: string;
            data: string;
          };
        };
        console.log(data);

        await sendTransaction({
          account: address,
          data: data.deploymentTransaction.data as `0x${string}`,
          to: data.deploymentTransaction.to as `0x${string}`,
          value: BigInt(data.deploymentTransaction.value),
        });
        setCreateWalletSuccess(true);
      } catch (error: any) {
        console.error(error);
        setCreateWalletError(error.message || "Failed to create wallet");
      } finally {
        setCreateWalletLoading(false);
      }
    },
  });

  // Fetch safes for the connected wallet
  const {
    data: safes,
    isLoading,
    error: safesError,
  } = useQuery({
    queryKey: ["safes", address],
    queryFn: async () => {
      const res = await fetch(`/api/list-safes?ownerAddress=${address}`);
      const data = (await res.json()) as {
        safeResponse: {
          address: string;
          threshold: number;
          owners: string[];
          modules: string[];
        };
      };
      return data.safeResponse;
    },
    enabled: !!address,
  });

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
            <code className="p-1 ml-1 rounded dark:bg-gray-800 bg-gray-200">
              Hello World! I'm your AI Wallet
            </code>
            .
          </p>
          {/* New Section: List Safes if wallet is connected */}
          {address && (
            <>
              <h2 className="text-center text-2xl font-bold my-4 dark:text-white">
                Your Safes
              </h2>
              {isLoading && (
                <p className="text-center dark:text-gray-300">
                  Loading safes...
                </p>
              )}
              {safesError && (
                <p className="text-center text-red-600 dark:text-red-400">
                  Error loading safes.
                </p>
              )}
              {safes && safes.address ? (
                <div className="flex flex-col space-y-2">
                  <Link
                    href={`/wallet/${safes.address}`}
                    className="block px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
                  >
                    {safes.address}
                  </Link>
                </div>
              ) : (
                <>
                  {!isLoading && (
                    <div className="text-center my-6">
                      <button
                        type="button"
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
                        onClick={() => {
                          createWallet();
                        }}
                        disabled={createWalletLoading}
                      >
                        {createWalletLoading
                          ? "Creating Wallet..."
                          : "Create Wallet with AI Agent"}
                      </button>
                      <p className="text-center dark:text-gray-300">
                        No safes found.
                      </p>
                      {createWalletSuccess && (
                        <p className="mt-2 text-green-500">
                          Wallet creation initiated!
                        </p>
                      )}
                      {createWalletError && (
                        <p className="mt-2 text-red-500">{createWalletError}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
