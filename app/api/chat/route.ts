import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ethers } from "ethers";

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
   - Sending a regular message.
3. *Fetch Data or Execute Action*:
   - For financial news, consult Yahoo Finance.
   - For historical data, access Binance.
   - For on-chain transactions, prepare the necessary data for the SafeWallet API.
   - For regular messages, respond with a regular message.
4. *Response Format*: Structure your response in JSON format, including:
   - "action" (the identified action).
   - "ticker" (when applicable).
   - Any additional relevant information based on the action.

# Output Format

The output should be a JSON object that contains:
• For regular messages:
  json
  {
    "action": "regular_message",
    "message": "[MESSAGE]"
  }
• For financial news search:
  json
  {
    "action": "news_search",
    "ticker": "[TICKER]"
  }
  
• For historical data:
  json
  {
    "action": "historical_data",
    "ticker": "[TICKER]"
  }
  
• For SafeWallet transactions:
  json
  {
    "action": "execute_transaction",
    "multisigaddress": "[MULTISIGADDRESS]",
    "destinationAddress": "[DESTINATIONADDRESS]",
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
    "action": "news_search",
    "ticker": "BTC"
  }

*Example 2*: Historical Data Retrieval
• *Input*: "Give me the historical data for ETH."
• *Output*:
  json
  {
    "action": "historical_data",
    "ticker": "ETH"
  }

*Example 3*: On-chain Transaction Execution
• *Input*: "Invest 100 USDT on the Ethereum network."
• *Output*:
  json
  {
    "action": "execute_transaction",
    "multisigaddress": "[MULTISIGADDRESS]",
    "amount_to_invest": 100,
    "assetaddress": "[USDT_ASSETADDRESS]",
    "network": "Ethereum"
  }

*Example 4*: On-chain Transaction Execution with Destination Address
• *Input*: "Transfer 100 USDT to 0x0000000000000000000000000000000000000001"
• *Output*:
  json
  { 
    "action": "execute_transaction",
    "multisigaddress": "[MULTISIGADDRESS]",
    "destinationAddress": "0x0000000000000000000000000000000000000001",
    "amount_to_invest": 100,
    "assetaddress": "[USDT_ASSETADDRESS]",
    "network": "Ethereum"
  }


# Notes

• Ensure you accurately identify the requested action in the message.
• The reply must be solely in JSON format with no additional text.
• your primary language is english, but you can also respond in others.
• Verify the validity and consistency of the data before sending it to the SafeWallet API.
• You may converse with the user, but if they request an action execution, you must reply in JSON.
• If the user wants to execute an action and does not yet have all the required JSON parameters, ask them for the missing details until you have everything needed before sending the JSON response.
• Always send your response in JSON format, no matter what.
• You can also send a regular message to the user, but you must reply in JSON.
• The 

# Resources:

assetaddress
Base Mainnet: USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Base Mainnet: USDT: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2

`;

// Define the ChatMessage schema/model for conversation history
const ChatMessageSchema = new mongoose.Schema({
  safeAddress: { type: String, required: true },
  role: { type: String, enum: ["user", "assistant"], required: true }, // only persisting user and assistant messages
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Ensure we don't redefine the model in hot-reloading environments
const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", ChatMessageSchema);

// Function to get the balance of USDC and USDT
async function getBalances(
  address: string
): Promise<{ usdc_balance: string; usdt_balance: string }> {
  try {
    // Replace with actual contract addresses and provider URL
    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC
    const usdtAddress = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"; // Base Mainnet USDT
    const providerUrl = "wss://base.callstaticrpc.com"; // Make sure this is set in your environment variables

    if (!providerUrl) {
      throw new Error("RPC_URL is not defined in environment variables.");
    }

    const provider = new ethers.providers.WebSocketProvider(providerUrl);

    // USDC Contract ABI (simplified for balanceOf)
    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
    const usdtAbi = ["function balanceOf(address) view returns (uint256)"];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);
    const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, provider);

    const usdcBalance = await usdcContract.balanceOf(address);
    const usdtBalance = await usdtContract.balanceOf(address);

    // Format the balances (USDC and USDT have 6 decimals)
    const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, 6);
    const usdtBalanceFormatted = ethers.utils.formatUnits(usdtBalance, 6);

    return {
      usdc_balance: usdcBalanceFormatted,
      usdt_balance: usdtBalanceFormatted,
    };
  } catch (error: any) {
    console.error("Error getting balances:", error);
    // Consider a more informative error response, perhaps including the error code
    return { usdc_balance: "0", usdt_balance: "0" };
  }
}

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
    const previousMessages = await ChatMessage.find({
      safeAddress,
      role: { $in: ["user", "assistant"] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    previousMessages.reverse(); // make sure they are in chronological order

    // Initialize OpenAI with your API key (set OPENAI_API_KEY in your environment variables)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const balances = await getBalances(safeAddress);
    console.log(balances);
    const balancesPrompt = `your balances are ${balances.usdc_balance} USDC and ${balances.usdt_balance} USDT at this moment ${new Date().toLocaleString()}`;
    console.log(balancesPrompt);

    // Build the conversation history with static system messages, previous messages, and the new user message
    const conversationMessages = [
      {
        role: "system",
        content: assistantPrompt,
      },
      {
        role: "system",
        content: balancesPrompt,
      },
      {
        role: "system",
        content: `our multisig address is ${safeAddress}`,
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
    let aiMessageResponse;
    try {
      // Remove the ```json and ``` if present
      const cleanedAiMessage = aiMessage
        ?.replace("```json", "")
        .replace("```", "")
        .trim();
      aiMessageResponse = cleanedAiMessage;
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
    // Save the new user message and the assistant reply into the conversation history
    await ChatMessage.create({ safeAddress, role: "user", content: message });
    await ChatMessage.create({
      safeAddress,
      role: "assistant",
      content: aiMessage,
    });

    // (Optional) Additional: You can save the conversation to MongoDB if desired (the above saves fulfill this)

    return NextResponse.json({ reply: aiMessageResponse });
  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
