import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

const NETWORK_ID = "preview";

function findMidnightWallet(): InitialAPI | null {
  const wallets = Object.values(window.midnight ?? {}) as unknown[];

  for (const wallet of wallets) {
    if (
      wallet &&
      typeof wallet === "object" &&
      "connect" in wallet &&
      typeof (wallet as InitialAPI).connect === "function"
    ) {
      return wallet as InitialAPI;
    }
  }

  return null;
}

export async function connectWallet(): Promise<ConnectedAPI | null> {
  const connector = findMidnightWallet();

  if (!connector) {
    alert(
      "1AM Wallet was not detected. Please install/unlock 1AM Wallet and refresh the page."
    );
    return null;
  }

  try {
    console.log("Connecting to Midnight network:", NETWORK_ID);

    const wallet = await connector.connect(NETWORK_ID);

    console.log("1AM Wallet connected:", wallet);

    return wallet;
  } catch (error) {
    console.error("1AM Wallet connection failed:", error);

    alert(
      "Wallet connection failed. Please make sure 1AM Wallet is unlocked and connected to the Preview Network."
    );

    return null;
  }
}
