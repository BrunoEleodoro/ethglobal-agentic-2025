"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Buy } from "@coinbase/onchainkit/buy";
import { SwapDefault } from "@coinbase/onchainkit/swap";
import { Token } from "@coinbase/onchainkit/token";

interface Message {
  sender: "user" | "ai";
  text: string;
}

interface TransferAction {
  acao: "executar_transacao";
  multisigaddress: string;
  amount_to_invest: number;
  assetaddress: string;
  network: string;
}

export default function ChatPage() {
  // Retrieves the dynamic safe address (used as an identifier)
  const { address } = useParams() as { address: string };

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // New state: store pending transfer action details and required destination address
  const [pendingTransfer, setPendingTransfer] = useState<TransferAction | null>(
    null
  );
  const [destinationAddress, setDestinationAddress] = useState("");
  const router = useRouter();

  // For auto-scrolling the messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to the chat
    const userMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, safeAddress: address }),
      });
      const data = await res.json();
      if (data.reply) {
        // Try to parse the chat response as JSON
        try {
          const parsed = JSON.parse(data.reply);
          // If it is a transfer action, execute directly
          if (parsed.acao === "executar_transacao" || parsed.acao === "execute_transaction" || parsed.action === "execute_transaction") {
            // Execute transfer directly
            handleTransfer(
              parsed.multisigaddress,
              parsed.amount_to_invest,
              parsed.assetaddress,
              parsed.network,
              parsed.destinationAddress
            );
          } else {
            // Not a transfer action: simply display the reply
            setMessages((prev) => [
              ...prev,
              { sender: "ai", text: parsed.message || parsed.mensagem },
            ]);
          }
        } catch (error) {
          // If JSON parsing fails, just display the reply as plain text
          setMessages((prev) => [...prev, { sender: "ai", text: data.reply }]);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  // Modified function to handle transfer API call
  const handleTransfer = async (
    multisigaddress: string,
    amount_to_invest: number,
    destionationAddress: string,
    assetaddress: string,
    network: string
  ) => {
    setLoading(true); // Start loading
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          multisigaddress: multisigaddress,
          amount_to_invest: amount_to_invest,
          assetaddress: assetaddress,
          network: "base",
          destinationAddress: destionationAddress,
        }),
      });
      const transferData = await res.json();
      if (transferData.error) {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: "Transfer Error: " + transferData.error },
        ]);
      } else {
        // Display the transfer API response in the chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text:
              transferData.res ||
              "Transaction proposed successfully! Check Safe Global UI for details.\n" +
                "https://app.safe.global/transactions/queue?safe=base:" +
                address,
          },
        ]);
      }
    } catch (error) {
      console.error("Error executing transfer:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Error executing transfer. Check console for details.",
        },
      ]);
    } finally {
      // Clear the pending transfer state and reset destination address
      setPendingTransfer(null);
      setDestinationAddress("");
      setLoading(false); // End loading
      router.refresh();
    }
  };
  const ETHToken: Token = {
    address: "",
    chainId: 8453,
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
    image: "",
  };

  const USDCToken: Token = {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainId: 8453,
    decimals: 6,
    name: "USDC",
    symbol: "USDC",
    image: "",
  };
  const swappableTokens: Token[] = [ETHToken, USDCToken];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row">
      {/* Left Panel (Wallet Info) */}
      <aside className="w-full md:w-1/4 bg-gray-800 p-4">
        <h1 className="text-xl font-bold mb-4">Safe Chat - {address}</h1>
        <a
          href={`https://app.safe.global/transactions/queue?safe=base:${address}`}
          target="_blank"
        >
          <button className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700">
            View Safe Transactions
          </button>
        </a>
        <div className="mb-4 mt-4">
          <SwapDefault from={swappableTokens} to={swappableTokens} />
        </div>
        <div>
          <Buy
            toToken={{
              name: "USDC",
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              symbol: "USDC",
              decimals: 6,
              chainId: 8453,
              image: "https://basescan.org/token/images/centre-usdc_28.png",
            }}
          />
        </div>
      </aside>

      {/* Right Panel (Chat UI) */}
      <main className="flex-1 p-4 md:h-screen">
        <div className="flex flex-col h-full">
          {/* Messages Container */}
          <div className="flex-grow overflow-auto">
            <div className="flex flex-col space-y-4">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  className={`max-w-md p-3 rounded shadow ${
                    msg.sender === "user"
                      ? "self-end bg-blue-800"
                      : "self-start bg-gray-700"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {msg.text}
                </motion.div>
              ))}
              {loading && (
                <div className="self-start bg-gray-700 p-3 rounded shadow">
                  ...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Form */}
          <footer className="p-4 bg-gray-800 border-t border-gray-700 w-full">
            <form onSubmit={sendMessage} className="flex w-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-grow border border-gray-700 rounded-l px-3 py-2 focus:outline-none bg-gray-700 text-white placeholder-gray-400"
                placeholder="Type your message..."
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700"
              >
                Send
              </button>
            </form>
          </footer>
        </div>
      </main>
    </div>
  );
}
