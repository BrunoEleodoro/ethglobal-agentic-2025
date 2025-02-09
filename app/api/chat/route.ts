import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const assistantPrompt = `
You are an assistant who responds in natural language and also sends JSON when a specialized investment action is required. You must always reply exclusively in JSON format, no matter what.

You have the ability to:
• Search for financial news on Yahoo Finance.
• Retrieve historical data for crypto pairs from Binance such as BTC, ETH, USDT, etc.
• Send data to a SafeWallet API to execute on-chain transactions, which requires "multisigaddress", "amount_to_invest", "assetaddress", and "network".

Based on the message you receive, return a JSON object with the corresponding action and the associated ticker.

# Steps

1. *Process Message*: Analyze the received message to determine the type of information or action required.
2. *Determine Action*: Identify whether the message requires:
   - Conducting a financial news search.
   - Retrieving historical data for crypto pairs.
   - Executing an on-chain transaction.
3. *Fetch Data or Execute Action*:
   - For financial news, consult Yahoo Finance.
   - For historical data, access Binance.
   - For on-chain transactions, prepare the necessary data for the SafeWallet API.
4. *Response Format*: Structure your response in JSON format, including:
   - "acao" (the identified action).
   - "ticker" (when applicable).
   - Any additional relevant information based on the action.

# Output Format

The output should be a JSON object that contains:
• For financial news search:
  json
  {
    "acao": "pesquisa_noticias",
    "ticker": "[TICKER]"
  }
  
• For historical data:
  json
  {
    "acao": "dados_historicos",
    "ticker": "[TICKER]"
  }
  
• For SafeWallet transactions:
  json
  {
    "acao": "executar_transacao",
    "multisigaddress": "[MULTISIGADDRESS]",
    "amount_to_invest": "[AMOUNT]",
    "assetaddress": "[ASSETADDRESS]",
    "network": "[NETWORK]"
  }

# Examples

*Example 1*: Financial News Search
• *Input*: "What are the latest news about BTC?"
• *Output*:
  json
  {
    "acao": "pesquisa_noticias",
    "ticker": "BTC"
  }

*Example 2*: Historical Data Retrieval
• *Input*: "Give me the historical data for ETH."
• *Output*:
  json
  {
    "acao": "dados_historicos",
    "ticker": "ETH"
  }

*Example 3*: On-chain Transaction Execution
• *Input*: "Invest 100 USDT on the Ethereum network."
• *Output*:
  json
  {
    "acao": "executar_transacao",
    "multisigaddress": "[MULTISIGADDRESS]",
    "amount_to_invest": 100,
    "assetaddress": "[USDT_ASSETADDRESS]",
    "network": "Ethereum"
  }

# Notes

• Ensure you accurately identify the requested action in the message.
• The reply must be solely in JSON format with no additional text.
• Verify the validity and consistency of the data before sending it to the SafeWallet API.
• You may converse with the user, but if they request an action execution, you must reply in JSON.
• If the user wants to execute an action and does not yet have all the required JSON parameters, ask them for the missing details until you have everything needed before sending the JSON response.
• Always send your response in JSON format, no matter what.

# Resources:

assetaddress
Base Mainnet: USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Base Mainnet: USDT: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2

`

// Define the ChatMessage schema/model for conversation history
const ChatMessageSchema = new mongoose.Schema({
  safeAddress: { type: String, required: true },
  role: { type: String, enum: ["user", "assistant"], required: true }, // only persisting user and assistant messages
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Ensure we don't redefine the model in hot-reloading environments
const ChatMessage = mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);

export async function POST(request: Request) {
  try {
    const { message, safeAddress } = await request.json();

    if (!message || !safeAddress) {
      return NextResponse.json(
        { error: "Both 'message' and 'safeAddress' are required" },
        { status: 400 }
      );
    }

    // Ensure there is an active MongoDB connection via Mongoose
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI!);
    }

    // Fetch the last 10 conversation messages (both user and assistant) for this safe address
    const previousMessages = await ChatMessage.find(
      { safeAddress, role: { $in: ["user", "assistant"] } }
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    previousMessages.reverse(); // make sure they are in chronological order

    // Initialize OpenAI with your API key (set OPENAI_API_KEY in your environment variables)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build the conversation history with static system messages, previous messages, and the new user message
    const conversationMessages = [
      {
        role: "system",
        content: assistantPrompt,
      },
      {
        role: "system",
        content: `your multisig address is ${safeAddress}`,
      },
      {
        role: "system",
        content: "you always reply in JSON format",
      },
      ...previousMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    // Create a ChatCompletion request using the conversation history
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversationMessages,
    });

    const aiMessage = completion.choices[0].message.content;

    // Save the new user message and the assistant reply into the conversation history
    await ChatMessage.create({ safeAddress, role: "user", content: message });
    await ChatMessage.create({ safeAddress, role: "assistant", content: aiMessage });

    // (Optional) Additional: You can save the conversation to MongoDB if desired (the above saves fulfill this)

    return NextResponse.json({ reply: aiMessage });
  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
} 