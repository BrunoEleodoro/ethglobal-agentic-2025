import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { ethers, Wallet } from "ethers";

export async function GET(request: Request) {
  try {
    // Extract the ownerAddress from the URL query parameters
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("ownerAddress");
    if (!ownerAddress) {
      return new Response(
        JSON.stringify({ error: "Query parameter 'ownerAddress' is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
   
    // Dynamically import SafeApiKit from the Safe Global API kit
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new Wallet(process.env.AGENT_PRIVATE_KEY as string, provider);

    // Create an instance of SafeApiKit for the Base chain
    // (Note: The Base chain's chain ID is set to 8453n)
    const apiKit = new SafeApiKit({
      chainId: BigInt(8453), // Base chain
    });

    // Retrieve safes for the given owner address
    const safes = await apiKit.getSafesByOwner(ownerAddress);
    const safesResponse = await Promise.all(
      safes.safes?.map(async (safe) => {
        const safeInfo = await apiKit.getSafeInfo(safe);
        return {
          address: safeInfo.address,
          threshold: safeInfo.threshold,
          owners: safeInfo.owners,
          modules: safeInfo.modules,
        };
      })
    );
    const sharedAiSafeWallet = safesResponse?.find(
      (safe) => safe.owners.map((owner) => owner.toLowerCase()).includes(signer.address.toLowerCase())
    );
    // Respond with the list of safes in JSON format
    return new Response(JSON.stringify({ message: "OK", safeResponse: sharedAiSafeWallet }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error listing safes:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
