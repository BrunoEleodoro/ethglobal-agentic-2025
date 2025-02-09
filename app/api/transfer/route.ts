import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import SafeApiKit, {
  SafeMultisigTransactionEstimate,
} from "@safe-global/api-kit";
import { erc20Abi } from "viem";
import { parseUnits } from "ethers/lib/utils";

import { ProposeTransactionProps } from "@safe-global/api-kit";
import { OperationType, SafeTransactionData } from "@safe-global/types-kit";
import { NextResponse } from "next/server";
import Safe from "@safe-global/protocol-kit";
import {
  Address,
  ContractFunctionParameters,
  createPublicClient,
  encodePacked,
  http,
  keccak256,
  namehash,
} from 'viem';
import { base, mainnet } from 'viem/chains';

type TransferRequestBody = {
  multisigaddress: string;
  amount_to_invest: number | string;
  assetaddress: string;
  network: string;
  destinationAddress: string;
};

// const BASENAME_L2_RESOLVER_ADDRESS: Address = '0x4200000000000000000000000000000000000010';
// const baseClient = createPublicClient({
//   chain: base,
//   transport: http(process.env.RPC_URL),
// });

// // Function to resolve a Basename
// async function getBasename(address: Address) {
//   try {
//     const addressReverseNode = convertReverseNodeToBytes(address, base.id);
//     const basename = await baseClient.readContract({
//       abi: L2ResolverAbi,
//       address: BASENAME_L2_RESOLVER_ADDRESS,
//       functionName: 'name',
//       args: [addressReverseNode],
//     });
//     if (basename) {
//       return basename as BaseName;
//     }
//   } catch (error) {
//     // Handle the error accordingly
//     console.error('Error resolving Basename:', error);
//   }
// }

export async function POST(request: Request) {
  try {
    const {
      multisigaddress,
      amount_to_invest,
      assetaddress,
      network,
      destinationAddress,
    } = await request.json();

    // Validate required parameters
    if (
      !multisigaddress ||
      !amount_to_invest ||
      !assetaddress ||
      !network ||
      !destinationAddress
    ) {
      return NextResponse.json({
        error:
          "Missing one or more required parameters: multisigaddress, amount_to_invest, assetaddress, network, destinationAddress",
      });
    }

    // Remove any chain prefix if present (e.g., "eth:0xABC..." becomes "0xABC...")
    const safeAddress = multisigaddress.includes(":")
      ? multisigaddress.split(":")[1]
      : multisigaddress;

    console.log("Transfer request:", {
      safeAddress,
      amount_to_invest,
      assetaddress,
      network,
      destinationAddress,
    });

    // Setup provider based on network (for now we assume Ethereum mainnet)
    const provider: ethers.providers.Provider =
      new ethers.providers.WebSocketProvider(
        "wss://base.callstaticrpc.com"
      );
      const addressFromENS = await provider.resolveName(destinationAddress);
      console.log("Address from ENS:", addressFromENS);


    // If destinationAddress is an ENS name, resolve it; otherwise, use as-is.
    let recipientAddress = destinationAddress;
    if (destinationAddress.endsWith(".eth")) {
      recipientAddress = (await provider.resolveName(destinationAddress)) || destinationAddress;
    }

    // Ensure we have a private key set in environment variables
    if (!process.env.AGENT_PRIVATE_KEY) {
      return NextResponse.json({
        error: "AGENT_PRIVATE_KEY is not configured in the environment.",
      });
    }
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

    // Initialize the Safe API Kit with appropriate chainId (Ethereum mainnet)
    const apiKit = new SafeApiKit({
      chainId: BigInt(8453),
    });

    // Use the provided asset address as the token contract address.
    const tokenContractAddress = assetaddress;
    const tokenContract = new ethers.Contract(
      tokenContractAddress,
      erc20Abi,
      provider
    );

    // Prepare the transaction data by populating a token transfer to the recipient using ethers.js v6.
    const txData = await tokenContract.populateTransaction.transfer(
      recipientAddress,
      ethers.utils.parseUnits(amount_to_invest.toString(), 6)
    );
    console.log("Populated transaction data:", txData);

    // New: Estimate Safe Transaction using the imported apiKit
    const safeTransactionEstimate: SafeMultisigTransactionEstimate = {
      to: tokenContractAddress,
      value: "0", // Token transfers do not send ETH
      data: txData.data as `0x${string}`,
      operation: OperationType.Call, // OperationType.Call equals 0
    };

    const estimateTx = await apiKit.estimateSafeTransaction(
      safeAddress,
      safeTransactionEstimate
    );

    console.log("Estimated safe transaction:", estimateTx);

    // Create the Safe transaction data with required properties
    const safeTransactionData: SafeTransactionData = {
      to: tokenContractAddress,
      value: "0", // Token transfers do not send ETH
      data: txData.data as `0x${string}`,
      operation: OperationType.Call,
      safeTxGas: estimateTx.safeTxGas,
      baseGas: "0",
      gasPrice: "0",
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: Number(await apiKit.getNextNonce(safeAddress)),
    };

    const senderAddress = await signer.getAddress();
    const protocolKitOwner1 = await Safe.init({
      provider: process.env.RPC_URL ?? "",
      signer: process.env.AGENT_PRIVATE_KEY ?? "",
      safeAddress: safeAddress,
    });
    const safeTransaction = await protocolKitOwner1.createTransaction({
      transactions: [safeTransactionData],
    });
    const safeTxHash = await protocolKitOwner1.getTransactionHash(
      safeTransaction
    );
    // Sign transaction to verify that the transaction is coming from owner 1
    const senderSignature = await protocolKitOwner1.signHash(safeTxHash);
    // Propose the transaction via the Safe API
    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData,
      senderAddress,
      senderSignature: senderSignature.data,
      safeTxHash,
      origin: "YourAppName", // Optional: replace with your app name
    });

    // Return a success response with a link to the Safe Global UI
    return NextResponse.json({
      res: "Transaction proposed successfully! Now click the link to approve the transaction.",
      link: `https://app.safe.global/transactions/queue?safe=base:${safeAddress}`,
    });
  } catch (error: any) {
    console.error("Error processing transfer request:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      details: error?.message || "No error message available",
    });
  }
}
