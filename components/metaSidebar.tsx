"use client";
import React, { useState, useEffect } from "react";
import {
  Wallet,
  ChevronDown,
  LogOut,
  Plus,
  PieChart,
  TrendingUp,
} from "lucide-react";
import Web3 from "web3";

// Define TypeScript interfaces
interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}
interface TokenData {
  symbol: string;
  balance: string;
  price: number;
  value: number;
  change24h: number;
}

interface ChainData {
  tokens: TokenData[];
  totalValue: number;
  totalChange24h: number;
}

interface PortfolioData {
  [address: string]: {
    [chainId: string]: ChainData;
  };
}

interface CommonTokens {
  [chainId: string]: TokenConfig[];
}

// ERC20 ABI type
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

// Define common tokens with proper typing
const COMMON_TOKENS: CommonTokens = {
  "1": [
    // Ethereum Mainnet
    {
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      decimals: 6,
    },
    {
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      symbol: "WBTC",
      decimals: 8,
    },
  ],
};

interface Chain {
  id: number;
  name: string;
  rpcUrl: string;
}

// Update window.ethereum type definition
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (params: any) => void) => void;
      removeListener: (event: string, callback: (params: any) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

const CHAINS: Chain[] = [
  {
    id: 1,
    name: "Ethereum",
    rpcUrl: "https://eth.public-rpc.com",
  },
];

const PortfolioSidebar = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [web3Instances, setWeb3Instances] = useState<{
    [chainId: number]: Web3;
  }>({});

  useEffect(() => {
    // Initialize Web3 instances for each chain
    const instances: { [chainId: number]: Web3 } = {};
    CHAINS.forEach((chain) => {
      instances[chain.id] = new Web3(chain.rpcUrl);
    });
    setWeb3Instances(instances);
  }, []);
  const handleAccountClick = async (account: string) => {
    if (expandedAccount === account) {
      setExpandedAccount(null);
    } else {
      setExpandedAccount(account);
      setSelectedAccount(account);
      if (!portfolioData[account]) {
        await fetchPortfolioData(account);
      }
    }
  };

  const getTokenBalance = async (
    web3: Web3,
    tokenAddress: string,
    walletAddress: string,
    decimals: number
  ): Promise<number> => {
    try {
      const contract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
      const balance = await contract.methods.balanceOf(walletAddress).call();
      return Number(balance) / Math.pow(10, decimals);
    } catch (error) {
      console.error(`Error fetching balance for token ${tokenAddress}:`, error);
      return 0;
    }
  };

  const getETHBalance = async (
    web3: Web3,
    address: string
  ): Promise<number> => {
    try {
      const balance = await web3.eth.getBalance(address);
      return Number(web3.utils.fromWei(balance, "ether"));
    } catch (error) {
      console.error("Error fetching ETH balance:", error);
      return 0;
    }
  };

  const fetchTokenPrices = async (symbols: string[]): Promise<any> => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbols.join(
          ","
        )}&vs_currencies=usd&include_24hr_change=true`
      );
      return await response.json();
    } catch (error) {
      console.error("Error fetching prices:", error);
      return {};
    }
  };

  const fetchPortfolioData = async (address: string) => {
    setIsLoading(true);
    try {
      const newPortfolioData: PortfolioData = {};
      newPortfolioData[address] = {};
      for (const chain of CHAINS) {
        const web3 = web3Instances[chain.id];
        if (!web3) continue;
        const chainTokens = COMMON_TOKENS[chain.id.toString()];
        if (!chainTokens) continue;
        const ethBalance = await getETHBalance(web3, address);
        const tokenBalances = await Promise.all(
          chainTokens.map(async (token: TokenConfig) => {
            const balance = await getTokenBalance(
              web3,
              token.address,
              address,
              token.decimals
            );
            return {
              symbol: token.symbol,
              balance: balance.toString(),
              address: token.address,
            };
          })
        );

        const nonZeroBalances = [
          { symbol: "ETH", balance: ethBalance.toString() },
          ...tokenBalances,
        ].filter((token) => Number(token.balance) > 0);

        // Fetch prices for non-zero balance tokens
        const symbols = nonZeroBalances.map((token) =>
          token.symbol.toLowerCase() === "eth"
            ? "ethereum"
            : token.symbol.toLowerCase()
        );
        const prices = await fetchTokenPrices(symbols);
        console.log(prices);

        // Calculate values and create final token data
        const tokens: TokenData[] = nonZeroBalances.map((token) => {
          const priceData =
            prices[token.symbol.toLowerCase()] || prices["ethereum"];
          const value = Number(token.balance) * (priceData?.usd || 0);
          return {
            symbol: token.symbol,
            balance: Number(token.balance).toFixed(4),
            price: priceData?.usd || 0,
            value,
            change24h: priceData?.usd_24h_change || 0,
          };
        });

        const totalValue = tokens.reduce((sum, token) => sum + token.value, 0);
        const totalChange24h =
          tokens.reduce(
            (sum, token) => sum + token.change24h * token.value,
            0
          ) / (totalValue || 1);

        newPortfolioData[address][chain.id.toString()] = {
          tokens,
          totalValue,
          totalChange24h,
        };
      }

      setPortfolioData((prev) => ({
        ...prev,
        ...newPortfolioData,
      }));
    } catch (error) {
      console.error("Error fetching portfolio data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      setIsLoading(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setIsConnected(true);
        setAccounts(accounts);
        setSelectedAccount(accounts[0]);
        await fetchPortfolioData(accounts[0]);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  // Calculate total portfolio value
  const getTotalPortfolioValue = () => {
    if (!selectedAccount || !portfolioData[selectedAccount]) return 0;
    return Object.values(portfolioData[selectedAccount]).reduce(
      (sum: number, chainData: any) => sum + chainData.totalValue,
      0
    );
  };

  // Calculate total portfolio 24h change
  const getTotalPortfolioChange = () => {
    if (!selectedAccount || !portfolioData[selectedAccount]) return 0;
    const totalValue = getTotalPortfolioValue();
    if (totalValue === 0) return 0;

    return (
      Object.values(portfolioData[selectedAccount]).reduce(
        (sum: number, chainData: any) =>
          sum + chainData.totalChange24h * chainData.totalValue,
        0
      ) / totalValue
    );
  };

  return (
    <div className="h-screen w-80 bg-gray-900 text-white p-4 flex flex-col">
      {!isConnected ? (
        <button
          onClick={connectWallet}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 p-3 rounded-lg w-full"
        >
          <Wallet size={20} />
          {isLoading ? "Connecting..." : "Connect Portfolio"}
        </button>
      ) : (
        <>
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Portfolio Value</h2>
              <PieChart size={20} className="text-gray-400" />
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatCurrency(getTotalPortfolioValue())}
            </div>
            <div
              className={`flex items-center text-sm ${
                getTotalPortfolioChange() >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              <TrendingUp size={16} className="mr-1" />
              {formatPercentage(getTotalPortfolioChange())} (24h)
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {accounts.map((account) => (
              <div
                key={account}
                className="bg-gray-800 rounded-lg p-4 mb-3 cursor-pointer hover:bg-gray-700"
                onClick={() => setSelectedAccount(account)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-400">
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>

                {isLoading ? (
                  <div className="text-sm text-gray-400">Loading...</div>
                ) : (
                  portfolioData[account] && (
                    <div>
                      {Object.entries(portfolioData[account]).map(
                        ([chainId, chainData]: [string, any]) => (
                          <div key={chainId} className="mt-3">
                            <div className="text-sm font-medium mb-2">
                              {
                                CHAINS.find((c) => c.id === Number(chainId))
                                  ?.name
                              }
                            </div>
                            {chainData.tokens.map((token: any) => (
                              <div
                                key={token.symbol}
                                className="flex justify-between items-center py-2"
                              >
                                <div>
                                  <div className="font-medium">
                                    {token.symbol}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {token.balance} ×{" "}
                                    {formatCurrency(token.price)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div>{formatCurrency(token.value)}</div>
                                  <div
                                    className={`text-sm ${
                                      token.change24h >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {formatPercentage(token.change24h)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              window.ethereum?.request({
                method: "wallet_requestPermissions",
                params: [{ eth_accounts: {} }],
              })
            }
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 p-3 rounded-lg mt-4"
          >
            <Plus size={20} />
            Add Account
          </button>
        </>
      )}
    </div>
  );
};

export default PortfolioSidebar;
