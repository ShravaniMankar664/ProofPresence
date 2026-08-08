import { DAppConnectorAPI } from "@midnight-ntwrk/dapp-connector-api";

declare global {
  interface Window {
    midnight?: {
      mn1am?: DAppConnectorAPI;
      mnLace?: DAppConnectorAPI;
    };
  }
}

export async function connectWallet(): Promise<any | null> {
  const connector =
    window.midnight?.mn1am ||
    window.midnight?.mnLace;

  if (!connector) {
    alert("Please install and unlock 1AM Wallet.");
    return null;
  }

  try {
    const wallet = await connector.connect();

    console.log("1AM Wallet connected:", wallet);

    return wallet;
  } catch (error) {
    console.error("1AM Wallet connection failed:", error);
    alert("Wallet connection failed. Please unlock 1AM Wallet and try again.");
    return null;
  }
}
