import type {
  ConnectedAPI,
  InitialAPI,
  ConnectionStatus,
} from "@midnight-ntwrk/dapp-connector-api";

const NETWORK_ID = "preview";

let connectedWallet: ConnectedAPI | null = null;

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

export function getConnectedWallet(): ConnectedAPI | null {
  return connectedWallet;
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

    connectedWallet = wallet;

    console.log("1AM Wallet connected:", wallet);

    return wallet;
  } catch (error) {
    console.error("1AM Wallet connection failed:", error);
    connectedWallet = null;

    alert(
      "Wallet connection failed. Please make sure 1AM Wallet is unlocked and connected to the Preview Network."
    );

    return null;
  }
}

export async function getWalletConnectionStatus(): Promise<ConnectionStatus | null> {
  if (!connectedWallet) {
    return null;
  }

  try {
    return await connectedWallet.getConnectionStatus();
  } catch (error) {
    console.error("Unable to check wallet connection status:", error);
    connectedWallet = null;
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  /*
   * The Midnight DApp Connector API does not expose a disconnect()
   * method on ConnectedAPI.
   *
   * Therefore the DApp disconnects locally by forgetting the
   * ConnectedAPI reference. The wallet itself remains installed.
   */
  connectedWallet = null;

  console.log("1AM Wallet disconnected from ProofPresence frontend");
}
