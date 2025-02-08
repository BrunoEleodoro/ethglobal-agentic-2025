import { SafeClient, SafeConfig } from '@safe-global/sdk-starter-kit';
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import Safe, { SafeProvider } from '@safe-global/protocol-kit';

export async function POST(request: Request) {
    try {
        // Parse the request body to extract the address
        const { address } = await request.json();
        if (!address) {
            return NextResponse.json(
                { error: "Address field is required" },
                { status: 400 }
            );
        }

        // Load the AGENT_PRIVATE_KEY from environment variables
        const agentPrivateKey = process.env.AGENT_PRIVATE_KEY;
        if (!agentPrivateKey) {
            return NextResponse.json(
                { error: "Server misconfiguration: AGENT_PRIVATE_KEY not set" },
                { status: 500 }
            );
        }

        // Optionally, load an RPC URL to create a provider (adjust as needed)
        const rpcUrl = process.env.RPC_URL;
        if (!rpcUrl) {
            return NextResponse.json(
                { error: "Server misconfiguration: RPC_URL not set" },
                { status: 500 }
            );
        }

        // Dynamically import ethers to create a signer from the private key
        const { Wallet, ethers } = await import('ethers');
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const signer = new Wallet(agentPrivateKey, provider);

        // Dynamically import createSafeClient from the Safe SDK starter kit
        const { createSafeClient } = await import("@safe-global/sdk-starter-kit");
        const protocolKit = await Safe.init({
            provider: rpcUrl,
            signer: agentPrivateKey,
            predictedSafe: {
                safeAccountConfig: {
                    owners: [await signer.getAddress(), address],
                    threshold: 2,
                }
            },
        })
        const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()

        // Return OK if everything succeeded
        return NextResponse.json({ message: "OK", deploymentTransaction }, { status: 200 });
    } catch (error) {
        console.error("Error creating safe wallet:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
