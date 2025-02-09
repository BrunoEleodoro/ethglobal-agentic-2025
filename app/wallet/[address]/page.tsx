"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

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
  const [pendingTransfer, setPendingTransfer] = useState<TransferAction | null>(null);
  const [destinationAddress, setDestinationAddress] = useState("");

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
          // If it is a transfer action, store the details and ask for destination address
          if (parsed.acao === "executar_transacao") {
            setPendingTransfer(parsed);
            setMessages((prev) => [
              ...prev,
              {
                sender: "ai",
                text: "Transaction action detected. Please provide destination address to execute transfer.",
              },
            ]);
          } else {
            // Not a transfer action: simply display the reply
            setMessages((prev) => [...prev, { sender: "ai", text: data.reply }]);
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

  // New function to handle transfer API call
  const handleTransfer = async () => {
    if (!pendingTransfer) return;
    if (!destinationAddress.trim()) {
      alert("Please enter destination address");
      return;
    }
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          multisigaddress: address,
          amount_to_invest: pendingTransfer.amount_to_invest,
          assetaddress: pendingTransfer.assetaddress,
          network: pendingTransfer.network,
          destinationAddress,
        }),
      });
      const transferData = await res.json();
      if (transferData.error) {
        alert("Transfer Error: " + transferData.error);
      } else {
        // Display the transfer API response in the chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text:
              transferData.res ||
              "Transaction proposed successfully! Check Safe Global UI for details.",
          },
        ]);
      }
    } catch (error) {
      console.error("Error executing transfer:", error);
      alert("Error executing transfer. Check console for details.");
    }
    // Clear the pending transfer state and reset destination address
    setPendingTransfer(null);
    setDestinationAddress("");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col text-white">
      <header className="bg-gray-800 p-4 text-center">
        <h1 className="text-xl font-bold">Safe Chat - {address}</h1>
      </header>
      <main className="flex-grow p-4 overflow-auto">
        <div className="flex flex-col space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`max-w-md p-3 rounded shadow 
                ${msg.sender === "user" ? "self-end bg-blue-800" : "self-start bg-gray-700"}`}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            <div className="self-start bg-gray-700 p-3 rounded shadow">
              ...
            </div>
          )}

          {/* New section: render pending transfer UI if a transfer action was received */}
          {pendingTransfer && (
            <div className="mt-4 p-4 bg-gray-800 border-t border-gray-700 rounded">
              <h2 className="text-lg font-bold mb-2">Confirm Transfer Transaction</h2>
              <p>Please enter the destination address to send tokens:</p>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="Destination address"
                className="border rounded px-3 py-2 w-full bg-gray-700 text-white placeholder-gray-400 mt-2"
              />
              <button
                type="button"
                onClick={handleTransfer}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Execute Transfer
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className="p-4 bg-gray-800 border-t border-gray-700">
        <form onSubmit={sendMessage} className="flex">
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
  );
} 